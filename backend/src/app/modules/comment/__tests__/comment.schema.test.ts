import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 7) => new Date(Date.now() + days * 86_400_000);

maybe('extras-polish schema (Comment + Attachment + Notification)', () => {
  let userId: string;
  let projectId: string;
  let taskId: string;
  const tag = 'extras-schema';

  beforeAll(async () => {
    await prisma.notification.deleteMany({ where: { type: { startsWith: `${tag}.` } } });
    await prisma.attachment.deleteMany({ where: { filename: { startsWith: tag } } });
    await prisma.comment.deleteMany({ where: { body: { startsWith: tag } } });
    await prisma.task.deleteMany({ where: { title: { startsWith: tag } } });
    await prisma.project.deleteMany({ where: { name: { startsWith: tag } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: `${tag}@` } } });

    const u = await prisma.user.create({
      data: {
        email: `${tag}@test.local`,
        name: 'Extras Schema',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'admin',
      },
    });
    userId = u.id;

    const p = await prisma.project.create({
      data: { name: `${tag} Proj`, deadline: future(30), status: 'active', createdBy: userId },
    });
    projectId = p.id;

    const t = await prisma.task.create({
      data: {
        projectId,
        title: `${tag} task`,
        dueDate: future(7),
        createdBy: userId,
      },
    });
    taskId = t.id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { recipientId: userId } });
    await prisma.attachment.deleteMany({ where: { taskId } });
    await prisma.comment.deleteMany({ where: { taskId } });
    await prisma.task.deleteMany({ where: { id: taskId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await disconnectPrisma();
  });

  it('inserts a comment with FK to task + author', async () => {
    const c = await prisma.comment.create({
      data: { taskId, authorId: userId, body: `${tag} hello world` },
    });
    expect(c.id).toBeTruthy();
    expect(c.taskId).toBe(taskId);
    expect(c.authorId).toBe(userId);
    expect(c.body).toContain('hello world');
    expect(c.createdAt).toBeInstanceOf(Date);
    expect(c.updatedAt).toBeInstanceOf(Date);
  });

  it('inserts an attachment with storagePath + size + mime', async () => {
    const a = await prisma.attachment.create({
      data: {
        taskId,
        uploaderId: userId,
        filename: `${tag}-doc.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1234,
        storagePath: 'uploads/abc-extras-schema-doc.pdf',
      },
    });
    expect(a.id).toBeTruthy();
    expect(a.storagePath).toContain('uploads/');
    expect(a.sizeBytes).toBe(1234);
    expect(a.mimeType).toBe('application/pdf');
  });

  it('inserts a notification with readAt null by default', async () => {
    const n = await prisma.notification.create({
      data: {
        recipientId: userId,
        actorId: userId,
        type: `${tag}.task.assigned`,
        entityType: 'task',
        entityId: taskId,
        projectId,
        payload: { taskTitle: `${tag} task` },
      },
    });
    expect(n.id).toBeTruthy();
    expect(n.readAt).toBeNull();
    expect(n.payload).toMatchObject({ taskTitle: `${tag} task` });
  });

  it('queries comments + notifications by indexed fields', async () => {
    const cs = await prisma.comment.findMany({
      where: { taskId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10,
    });
    expect(cs.length).toBeGreaterThan(0);
    expect(cs.every((c) => c.taskId === taskId)).toBe(true);

    const ns = await prisma.notification.findMany({
      where: { recipientId: userId, readAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10,
    });
    expect(ns.length).toBeGreaterThan(0);
    expect(ns.every((n) => n.recipientId === userId && n.readAt === null)).toBe(true);
  });
});
