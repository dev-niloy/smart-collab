import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { dashboardService } from '../dashboard.service';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 30) => new Date(Date.now() + days * 86_400_000);
const u = (label: string) =>
  `dash-prod-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;

maybe('dashboardService.getProductivity', () => {
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
      data: { name: `dash-prod-${Date.now()}`, deadline: future(), createdBy: actorId },
    });
    projectId = p.id;
    cleanupProjectIds.push(projectId);

    // create 2 completed tasks; updatedAt is auto so they all count as today
    await prisma.task.createMany({
      data: [
        { projectId, title: 'p1', dueDate: future(10), status: 'completed', priority: 'low', createdBy: actorId },
        { projectId, title: 'p2', dueDate: future(10), status: 'completed', priority: 'low', createdBy: actorId },
      ],
    });
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: cleanupProjectIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    await disconnectPrisma();
  });

  it('returns array of length=days', async () => {
    const out = await dashboardService.getProductivity({ actorId, projectId }, 7);
    expect(out).toHaveLength(7);
  });

  it('dates ascending ending today (UTC)', async () => {
    const out = await dashboardService.getProductivity({ actorId, projectId }, 5);
    expect(out.every((p, i) => i === 0 || out[i - 1].date <= p.date)).toBe(true);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    expect(out[out.length - 1].date).toBe(dashboardService._dateKey(today));
  });

  it('zero-fills days w/ no completed tasks', async () => {
    const out = await dashboardService.getProductivity({ actorId, projectId }, 7);
    // first 6 days should be 0; today should have at least 2
    for (let i = 0; i < 6; i++) {
      expect(out[i].completed).toBe(0);
    }
    expect(out[6].completed).toBeGreaterThanOrEqual(2);
  });

  it('global aggregates across projects', async () => {
    const out = await dashboardService.getProductivity({ actorId }, 7);
    expect(out).toHaveLength(7);
    expect(out[6].completed).toBeGreaterThanOrEqual(2);
  });

  it('scoped: empty project yields all zeros', async () => {
    const empty = await prisma.project.create({
      data: { name: `dash-prod-empty-${Date.now()}`, deadline: future(), createdBy: actorId },
    });
    cleanupProjectIds.push(empty.id);
    const out = await dashboardService.getProductivity({ actorId, projectId: empty.id }, 7);
    expect(out.every((p) => p.completed === 0)).toBe(true);
  });
});
