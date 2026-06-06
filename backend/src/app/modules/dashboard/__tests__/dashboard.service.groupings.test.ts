import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { dashboardService } from '../dashboard.service';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 30) => new Date(Date.now() + days * 86_400_000);
const u = (label: string) =>
  `dash-grp-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;

maybe('dashboardService.getStatusCounts + getPriorityCounts', () => {
  let actorId: string;
  let projectId: string;
  const cleanupUserIds: string[] = [];
  const cleanupProjectIds: string[] = [];

  beforeAll(async () => {
    const a = await prisma.user.create({
      data: { email: u('actor'), name: 'Actor', passwordHash: await bcrypt.hash('x', 4), role: 'admin' },
    });
    actorId = a.id;
    cleanupUserIds.push(actorId);
    const p = await prisma.project.create({
      data: { name: `dash-grp-${Date.now()}`, deadline: future(), createdBy: actorId },
    });
    projectId = p.id;
    cleanupProjectIds.push(projectId);

    await prisma.task.createMany({
      data: [
        { projectId, title: 'g1', dueDate: future(10), status: 'todo', priority: 'low', createdBy: actorId },
        { projectId, title: 'g2', dueDate: future(10), status: 'todo', priority: 'medium', createdBy: actorId },
        { projectId, title: 'g3', dueDate: future(10), status: 'in_progress', priority: 'high', createdBy: actorId },
        { projectId, title: 'g4', dueDate: future(10), status: 'completed', priority: 'high', createdBy: actorId },
      ],
    });
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: cleanupProjectIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    await disconnectPrisma();
  });

  describe('getStatusCounts', () => {
    it('returns scoped counts', async () => {
      const c = await dashboardService.getStatusCounts({ actorId, projectId });
      expect(c).toEqual({ todo: 2, in_progress: 1, completed: 1 });
    });

    it('zero-fills missing keys', async () => {
      const empty = await prisma.project.create({
        data: { name: `dash-grp-empty-${Date.now()}`, deadline: future(), createdBy: actorId },
      });
      cleanupProjectIds.push(empty.id);
      const c = await dashboardService.getStatusCounts({ actorId, projectId: empty.id });
      expect(c).toEqual({ todo: 0, in_progress: 0, completed: 0 });
    });

    it('global aggregates across projects', async () => {
      const c = await dashboardService.getStatusCounts({ actorId });
      // at least the scoped counts contribute; global ≥ scoped
      expect(c.todo).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getPriorityCounts', () => {
    it('returns scoped counts', async () => {
      const c = await dashboardService.getPriorityCounts({ actorId, projectId });
      expect(c).toEqual({ low: 1, medium: 1, high: 2 });
    });

    it('zero-fills missing keys', async () => {
      const empty = await prisma.project.create({
        data: { name: `dash-grp-empty2-${Date.now()}`, deadline: future(), createdBy: actorId },
      });
      cleanupProjectIds.push(empty.id);
      const c = await dashboardService.getPriorityCounts({ actorId, projectId: empty.id });
      expect(c).toEqual({ low: 0, medium: 0, high: 0 });
    });

    it('global aggregates across projects', async () => {
      const c = await dashboardService.getPriorityCounts({ actorId });
      expect(c.high).toBeGreaterThanOrEqual(2);
    });
  });
});
