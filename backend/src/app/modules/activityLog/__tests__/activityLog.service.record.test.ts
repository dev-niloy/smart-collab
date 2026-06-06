import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { recordActivity } from '../activityLog.service';

const TEST_EMAIL = 'act-record@test.local';
const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 7) => new Date(Date.now() + days * 86_400_000);

maybe('recordActivity', () => {
  let actorId: string;
  let projectId: string;

  beforeAll(async () => {
    await prisma.activityLog.deleteMany({ where: { action: { startsWith: 'task.' } } });
    await prisma.activityLog.deleteMany({ where: { action: { startsWith: 'project.' } } });
    await prisma.project.deleteMany({ where: { name: { startsWith: 'ActRec' } } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    const u = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Act Rec',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'admin',
      },
    });
    actorId = u.id;
    const p = await prisma.project.create({
      data: { name: 'ActRec Proj', deadline: future(30), status: 'active', createdBy: actorId },
    });
    projectId = p.id;
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { actorId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await disconnectPrisma();
  });

  it('writes row with required fields inside a transaction', async () => {
    const row = await prisma.$transaction(async (tx) =>
      recordActivity(tx, {
        actorId,
        action: 'task.created',
        entityType: 'task',
        entityId: projectId,
        projectId,
      }),
    );
    expect(row.action).toBe('task.created');
    expect(row.entityType).toBe('task');
    expect(row.projectId).toBe(projectId);
    expect(row.actorId).toBe(actorId);
  });

  it('allows null projectId for global activity', async () => {
    const row = await prisma.$transaction(async (tx) =>
      recordActivity(tx, {
        actorId,
        action: 'project.created',
        entityType: 'project',
        entityId: projectId,
      }),
    );
    expect(row.projectId).toBeNull();
  });

  it('sanitises meta to whitelist only', async () => {
    const row = await prisma.$transaction(async (tx) =>
      recordActivity(tx, {
        actorId,
        action: 'task.updated',
        entityType: 'task',
        entityId: projectId,
        projectId,
        meta: { title: 'New', passwordHash: 'leak', token: 'leak' } as Record<string, unknown>,
      }),
    );
    const meta = row.meta as Record<string, unknown>;
    expect(meta).toEqual({ title: 'New' });
    expect(meta).not.toHaveProperty('passwordHash');
  });

  it('throws on unknown action', async () => {
    await expect(
      prisma.$transaction(async (tx) =>
        recordActivity(tx, {
          actorId,
          action: 'does.not.exist',
          entityType: 'task',
          entityId: projectId,
        }),
      ),
    ).rejects.toMatchObject({
      code: 'UNKNOWN_ACTIVITY_ACTION',
    });
  });

  it('rolls back when outer transaction fails', async () => {
    const before = await prisma.activityLog.count({ where: { action: 'task.deleted', actorId } });
    await expect(
      prisma.$transaction(async (tx) => {
        await recordActivity(tx, {
          actorId,
          action: 'task.deleted',
          entityType: 'task',
          entityId: projectId,
          projectId,
        });
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const after = await prisma.activityLog.count({ where: { action: 'task.deleted', actorId } });
    expect(after).toBe(before);
  });
});
