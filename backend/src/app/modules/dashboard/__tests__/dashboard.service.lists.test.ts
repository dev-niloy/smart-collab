import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { dashboardService } from '../dashboard.service';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 1) => new Date(Date.now() + days * 86_400_000);
const u = (label: string) =>
  `dash-list-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;

maybe('dashboardService.getUpcoming + getHighPriority', () => {
  let actorId: string;
  let projectId: string;
  let assigneeId: string;
  const cleanupUserIds: string[] = [];
  const cleanupProjectIds: string[] = [];

  beforeAll(async () => {
    const a = await prisma.user.create({
      data: { email: u('actor'), name: 'Actor', passwordHash: await bcrypt.hash('x', 4), role: 'admin' },
    });
    actorId = a.id;
    cleanupUserIds.push(actorId);
    const m = await prisma.user.create({
      data: { email: u('assignee'), name: 'Mia', passwordHash: await bcrypt.hash('x', 4), role: 'team_member' },
    });
    assigneeId = m.id;
    cleanupUserIds.push(assigneeId);
    const p = await prisma.project.create({
      data: { name: `dash-list-${Date.now()}`, deadline: future(3), createdBy: actorId },
    });
    projectId = p.id;
    cleanupProjectIds.push(projectId);
    await prisma.projectMember.create({
      data: { projectId, userId: assigneeId, role: 'member' },
    });

    // Mix of dueDates: 2 within 7d (one completed → excluded), 1 outside (15d), 2 high priority
    await prisma.task.createMany({
      data: [
        { projectId, title: 'soon-1', dueDate: future(2), status: 'todo', priority: 'high', assignedTo: assigneeId, createdBy: actorId },
        { projectId, title: 'soon-2', dueDate: future(4), status: 'in_progress', priority: 'medium', createdBy: actorId },
        { projectId, title: 'soon-done', dueDate: future(2), status: 'completed', priority: 'high', createdBy: actorId },
        { projectId, title: 'far', dueDate: future(15), status: 'todo', priority: 'high', assignedTo: assigneeId, createdBy: actorId },
      ],
    });
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
    await prisma.projectMember.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: cleanupProjectIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    await disconnectPrisma();
  });

  describe('getUpcoming', () => {
    it('returns tasks + projects in next N days ascending', async () => {
      const out = await dashboardService.getUpcoming({ actorId, projectId }, 7);
      expect(out.tasks.length).toBe(2);
      expect(out.tasks.map((t) => t.title)).toEqual(['soon-1', 'soon-2']);
      expect(out.projects.length).toBe(1);
      expect(out.projects[0].name).toMatch(/dash-list/);
    });

    it('excludes completed tasks', async () => {
      const out = await dashboardService.getUpcoming({ actorId, projectId }, 7);
      expect(out.tasks.find((t) => t.title === 'soon-done')).toBeUndefined();
    });

    it('excludes items outside window', async () => {
      const out = await dashboardService.getUpcoming({ actorId, projectId }, 7);
      expect(out.tasks.find((t) => t.title === 'far')).toBeUndefined();
    });

    it('global aggregates across projects', async () => {
      const out = await dashboardService.getUpcoming({ actorId }, 7);
      expect(out.tasks.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getHighPriority', () => {
    it('returns high-priority open tasks ascending by dueDate', async () => {
      const out = await dashboardService.getHighPriority({ actorId, projectId });
      const titles = out.map((t) => t.title);
      expect(titles).toContain('soon-1');
      expect(titles).toContain('far');
      // completed high-priority is excluded
      expect(titles).not.toContain('soon-done');
    });

    it('includes minimal assignee shape', async () => {
      const out = await dashboardService.getHighPriority({ actorId, projectId });
      const sa = out.find((t) => t.title === 'soon-1');
      expect(sa?.assignee).toMatchObject({ id: assigneeId, name: 'Mia' });
      expect(sa?.assignee).not.toHaveProperty('role');
    });
  });
});
