import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { listGlobal, listByProject } from '../activityLog.service';

const ACTOR_EMAIL = 'act-list@test.local';
const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 7) => new Date(Date.now() + days * 86_400_000);

maybe('activityLog list', () => {
  let actorId: string;
  let projectA: string;
  let projectB: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: ACTOR_EMAIL } });
    const u = await prisma.user.create({
      data: {
        email: ACTOR_EMAIL,
        name: 'Listy',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'admin',
      },
    });
    actorId = u.id;
  });

  beforeEach(async () => {
    await prisma.activityLog.deleteMany({ where: { actorId } });
    await prisma.project.deleteMany({ where: { name: { startsWith: 'ListAct' } } });
    const a = await prisma.project.create({
      data: { name: 'ListAct A', deadline: future(30), status: 'active', createdBy: actorId },
    });
    const b = await prisma.project.create({
      data: { name: 'ListAct B', deadline: future(30), status: 'active', createdBy: actorId },
    });
    projectA = a.id;
    projectB = b.id;

    for (let i = 0; i < 12; i++) {
      await prisma.activityLog.create({
        data: {
          actorId,
          action: 'task.created',
          entityType: 'task',
          entityId: projectA,
          projectId: projectA,
          meta: { title: `A${i}` },
        },
      });
      await new Promise((r) => setTimeout(r, 2));
    }
    for (let i = 0; i < 3; i++) {
      await prisma.activityLog.create({
        data: {
          actorId,
          action: 'task.updated',
          entityType: 'task',
          entityId: projectB,
          projectId: projectB,
          meta: { title: `B${i}` },
        },
      });
      await new Promise((r) => setTimeout(r, 2));
    }
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { actorId } });
    await prisma.project.deleteMany({ where: { name: { startsWith: 'ListAct' } } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await disconnectPrisma();
  });

  it('listGlobal returns latest first', async () => {
    const out = await listGlobal({ limit: 5 });
    expect(out.items.length).toBe(5);
    for (let i = 0; i < out.items.length - 1; i++) {
      const a = new Date(out.items[i].createdAt).getTime();
      const b = new Date(out.items[i + 1].createdAt).getTime();
      expect(a).toBeGreaterThanOrEqual(b);
    }
  });

  it('listGlobal returns nextCursor when more available', async () => {
    const out = await listGlobal({ limit: 5 });
    expect(out.nextCursor).not.toBeNull();
  });

  it('listGlobal cursor pagination fetches next page', async () => {
    const page1 = await listGlobal({ limit: 5 });
    const page2 = await listGlobal({ limit: 5, cursor: page1.nextCursor! });
    expect(page2.items.length).toBe(5);
    const overlap = page2.items.filter((i) => page1.items.some((p) => p.id === i.id));
    expect(overlap.length).toBe(0);
  });

  it('returns null nextCursor at end (project-scoped to avoid shared-DB pollution)', async () => {
    // listGlobal queries the entire activity_logs table, so cross-suite rows
    // seeded by other tests (notification.triggers, task.routes, etc.) leak
    // into the result set and break a global "at end" assertion in a shared DB.
    // We assert end-of-page behavior on a project-scoped query where this
    // suite owns the row count exactly (3 rows seeded for projectB).
    const out = await listByProject(projectB, { limit: 50 });
    expect(out.nextCursor).toBeNull();
  });

  it('listByProject filters to projectId only', async () => {
    const out = await listByProject(projectB, { limit: 50 });
    expect(out.items.every((i) => i.projectId === projectB)).toBe(true);
    expect(out.items.length).toBe(3);
  });

  it('DTO shape includes required fields', async () => {
    const out = await listGlobal({ limit: 1 });
    const item = out.items[0];
    expect(item).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        action: expect.any(String),
        actorId: expect.any(String),
        actorName: expect.any(String),
        entityType: expect.any(String),
        entityId: expect.any(String),
        projectId: expect.any(String),
        createdAt: expect.anything(),
      }),
    );
  });

  it('actorName null when actor deleted', async () => {
    const orphanRow = await prisma.activityLog.create({
      data: {
        actorId: null,
        action: 'project.deleted',
        entityType: 'project',
        entityId: projectA,
      },
    });
    const out = await listGlobal({ limit: 50 });
    const o = out.items.find((i) => i.id === orphanRow.id);
    expect(o).toBeDefined();
    expect(o!.actorName).toBeNull();
  });

  it('honours limit override', async () => {
    const out = await listGlobal({ limit: 2 });
    expect(out.items.length).toBe(2);
  });
});
