import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { dashboardService } from '../dashboard.service';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 30) => new Date(Date.now() + days * 86_400_000);
const u = (label: string) =>
  `dash-kpis-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;

maybe('dashboardService.getKpis', () => {
  let actorId: string;
  let otherUserId: string;
  let projectA: string;
  let projectB: string;
  const cleanupUserIds: string[] = [];
  const cleanupProjectIds: string[] = [];

  beforeAll(async () => {
    const a = await prisma.user.create({
      data: { email: u('actor'), name: 'Actor', passwordHash: await bcrypt.hash('x', 4), role: 'admin' },
    });
    actorId = a.id;
    cleanupUserIds.push(actorId);
    const o = await prisma.user.create({
      data: { email: u('other'), name: 'Other', passwordHash: await bcrypt.hash('x', 4), role: 'team_member' },
    });
    otherUserId = o.id;
    cleanupUserIds.push(otherUserId);

    const pA = await prisma.project.create({
      data: { name: `dash-kpis-A-${Date.now()}`, deadline: future(), createdBy: actorId },
    });
    projectA = pA.id;
    cleanupProjectIds.push(projectA);
    const pB = await prisma.project.create({
      data: { name: `dash-kpis-B-${Date.now()}`, deadline: future(), createdBy: actorId },
    });
    projectB = pB.id;
    cleanupProjectIds.push(projectB);

    // ProjectMember rows so assignee guard passes
    await prisma.projectMember.createMany({
      data: [
        { projectId: projectA, userId: otherUserId, role: 'member' },
        { projectId: projectB, userId: otherUserId, role: 'member' },
      ],
    });

    // Seed tasks across both projects.
    // projectA: 5 tasks: 2 todo (actor assigned), 1 in_progress (other), 2 completed (actor)
    await prisma.task.createMany({
      data: [
        { projectId: projectA, title: 'kpi-a1', dueDate: future(10), status: 'todo', priority: 'medium', assignedTo: actorId, createdBy: actorId },
        { projectId: projectA, title: 'kpi-a2', dueDate: future(10), status: 'todo', priority: 'medium', assignedTo: actorId, createdBy: actorId },
        { projectId: projectA, title: 'kpi-a3', dueDate: future(10), status: 'in_progress', priority: 'high', assignedTo: otherUserId, createdBy: actorId },
        { projectId: projectA, title: 'kpi-a4', dueDate: future(10), status: 'completed', priority: 'low', assignedTo: actorId, createdBy: actorId },
        { projectId: projectA, title: 'kpi-a5', dueDate: future(10), status: 'completed', priority: 'low', assignedTo: actorId, createdBy: actorId },
      ],
    });
    // projectB: 1 task, todo, assigned other
    await prisma.task.create({
      data: { projectId: projectB, title: 'kpi-b1', dueDate: future(10), status: 'todo', priority: 'high', assignedTo: otherUserId, createdBy: actorId },
    });
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
    await prisma.projectMember.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: cleanupProjectIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    await disconnectPrisma();
  });

  it('global: aggregates across all projects', async () => {
    const k = await dashboardService.getKpis({ actorId });
    expect(k.totalProjects).toBeGreaterThanOrEqual(2);
    expect(k.totalTasks).toBeGreaterThanOrEqual(6);
    expect(k.completedTasks).toBeGreaterThanOrEqual(2);
  });

  it('scoped: limits to projectA', async () => {
    const k = await dashboardService.getKpis({ actorId, projectId: projectA });
    expect(k.totalProjects).toBe(1);
    expect(k.totalTasks).toBe(5);
    expect(k.completedTasks).toBe(2);
  });

  it('completionPct rounds to nearest int', async () => {
    const k = await dashboardService.getKpis({ actorId, projectId: projectA });
    // 2/5 = 0.4 -> 40
    expect(k.completionPct).toBe(40);
  });

  it('division by zero → 0% when no tasks', async () => {
    // create empty project
    const empty = await prisma.project.create({
      data: { name: `dash-kpis-empty-${Date.now()}`, deadline: future(), createdBy: actorId },
    });
    cleanupProjectIds.push(empty.id);
    const k = await dashboardService.getKpis({ actorId, projectId: empty.id });
    expect(k.completionPct).toBe(0);
    expect(k.totalTasks).toBe(0);
  });

  it('myOpenTasks counts actor assignments excluding completed', async () => {
    const k = await dashboardService.getKpis({ actorId, projectId: projectA });
    // actor assigned: 2 todo + 2 completed; open = 2
    expect(k.myOpenTasks).toBe(2);
  });
});
