import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { enqueue, enqueueMany } from '../notification.service';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;
const future = (days = 7) => new Date(Date.now() + days * 86_400_000);
const tag = 'notif-enq';

maybe('notification.enqueue', () => {
  let actorId: string;
  let recipientId: string;
  let projectId: string;
  let taskId: string;

  beforeAll(async () => {
    await prisma.notification.deleteMany({ where: { type: { in: ['task.assigned', 'comment.created'] } } });
    await prisma.task.deleteMany({ where: { title: { startsWith: tag } } });
    await prisma.project.deleteMany({ where: { name: { startsWith: tag } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });

    actorId = (await prisma.user.create({
      data: { email: `${tag}-actor@t.local`, name: 'Actor', passwordHash: await bcrypt.hash('x', 4), role: 'admin' },
    })).id;
    recipientId = (await prisma.user.create({
      data: { email: `${tag}-recip@t.local`, name: 'Recip', passwordHash: await bcrypt.hash('x', 4), role: 'team_member' },
    })).id;
    projectId = (await prisma.project.create({
      data: { name: `${tag} Proj`, deadline: future(30), status: 'active', createdBy: actorId },
    })).id;
    taskId = (await prisma.task.create({
      data: { projectId, title: `${tag} task`, dueDate: future(), createdBy: actorId },
    })).id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { recipientId: { in: [actorId, recipientId] } } });
    await prisma.task.deleteMany({ where: { id: taskId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: { in: [actorId, recipientId] } } });
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany({ where: { recipientId: { in: [actorId, recipientId] } } });
  });

  it('enqueue writes a notification row with readAt null', async () => {
    const row = await prisma.$transaction(async (tx) =>
      enqueue(tx, {
        recipientId,
        actorId,
        type: 'task.assigned',
        entityType: 'task',
        entityId: taskId,
        projectId,
        payload: { taskTitle: `${tag} task` },
      }),
    );
    expect(row).not.toBeNull();
    expect(row!.recipientId).toBe(recipientId);
    expect(row!.actorId).toBe(actorId);
    expect(row!.readAt).toBeNull();
    expect(row!.payload).toMatchObject({ taskTitle: `${tag} task` });
  });

  it('enqueue returns null when actor == recipient (self-notify skip)', async () => {
    const row = await prisma.$transaction(async (tx) =>
      enqueue(tx, {
        recipientId: actorId,
        actorId,
        type: 'task.assigned',
        entityType: 'task',
        entityId: taskId,
        projectId,
      }),
    );
    expect(row).toBeNull();
    const count = await prisma.notification.count({ where: { recipientId: actorId } });
    expect(count).toBe(0);
  });

  it('enqueue throws on unknown type', async () => {
    await expect(
      prisma.$transaction(async (tx) =>
        enqueue(tx, {
          recipientId,
          actorId,
          type: 'task.deleted' as never,
          entityType: 'task',
          entityId: taskId,
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 500 });
  });

  it('payload is whitelisted + string-capped', async () => {
    const long = 'x'.repeat(500);
    const row = await prisma.$transaction(async (tx) =>
      enqueue(tx, {
        recipientId,
        actorId,
        type: 'comment.created',
        entityType: 'comment',
        entityId: taskId,
        payload: { taskTitle: long, password: 'leak', commentExcerpt: 'ok' },
      }),
    );
    const payload = row!.payload as Record<string, unknown>;
    expect((payload.taskTitle as string).length).toBe(200);
    expect((payload.taskTitle as string).endsWith('…')).toBe(true);
    expect(payload.commentExcerpt).toBe('ok');
    expect(payload).not.toHaveProperty('password');
  });

  it('enqueueMany dedupes by recipient and skips actor', async () => {
    const rows = await prisma.$transaction(async (tx) =>
      enqueueMany(tx, [
        { recipientId, actorId, type: 'comment.created', entityType: 'comment', entityId: taskId },
        { recipientId, actorId, type: 'comment.created', entityType: 'comment', entityId: taskId },
        { recipientId: actorId, actorId, type: 'comment.created', entityType: 'comment', entityId: taskId },
      ]),
    );
    expect(rows.length).toBe(1);
    const all = await prisma.notification.count({ where: { entityId: taskId, type: 'comment.created' } });
    expect(all).toBe(1);
  });
});
