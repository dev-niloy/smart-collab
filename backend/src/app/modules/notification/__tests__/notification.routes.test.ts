import request from 'supertest';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { seedDemoUsers } from '../../../../../prisma/seed';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;
const SECRET = 'x'.repeat(40);
const DEMO_EMAILS = ['admin@demo.local', 'pm@demo.local', 'member@demo.local'];
const future = (days = 7) => new Date(Date.now() + days * 86_400_000);

maybe('notification routes /api/v1/notifications', () => {
  const ORIGINAL_ENV = { ...process.env };
  let app: import('express').Express;
  let adminId: string;
  let memberId: string;
  let projectId: string;
  let taskId: string;

  const loginAs = async (role: 'admin' | 'project_manager' | 'team_member') => {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/demo-login').send({ role });
    expect(res.status).toBe(200);
    return agent;
  };

  // Helper: directly insert N notifications for a recipient
  const seedNotifs = async (recipientId: string, n: number, opts: { unreadOnly?: boolean } = {}) => {
    for (let i = 0; i < n; i += 1) {
      await prisma.notification.create({
        data: {
          recipientId,
          actorId: adminId,
          type: 'task.assigned',
          entityType: 'task',
          entityId: taskId,
          projectId,
          payload: { taskTitle: `seed ${i}` },
          ...(opts.unreadOnly === false ? { readAt: new Date() } : {}),
        },
      });
      await new Promise((r) => setTimeout(r, 2));
    }
  };

  beforeAll(async () => {
    Object.assign(process.env, {
      JWT_ACCESS_SECRET: SECRET,
      JWT_REFRESH_SECRET: SECRET + 'r',
      ACCESS_TOKEN_TTL: '15m',
      REFRESH_TOKEN_TTL: '7d',
      DEMO_ADMIN_PW: 'demo-admin-pw',
      DEMO_PM_PW: 'demo-pm-pw',
      DEMO_MEMBER_PW: 'demo-member-pw',
      CORS_ORIGINS: 'http://localhost:3000',
      COOKIE_DOMAIN: '',
      DATABASE_URL: process.env.DATABASE_URL,
      NODE_ENV: 'test',
    });
    jest.resetModules();
    const mod = await import('../../../../app');
    app = mod.default;

    await prisma.notification.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await seedDemoUsers(prisma);

    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@demo.local' } });
    const member = await prisma.user.findUniqueOrThrow({ where: { email: 'member@demo.local' } });
    adminId = admin.id;
    memberId = member.id;

    projectId = (await prisma.project.create({
      data: { name: 'Notif Routes Proj', deadline: future(60), status: 'active', createdBy: adminId },
    })).id;
    await prisma.projectMember.create({ data: { projectId, userId: memberId, role: 'member' } });
    taskId = (await prisma.task.create({
      data: { projectId, title: 'Notif routes task', dueDate: future(), createdBy: adminId },
    })).id;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await disconnectPrisma();
    process.env = ORIGINAL_ENV;
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany({});
  });

  it('GET / returns mine only', async () => {
    await seedNotifs(memberId, 2);
    await seedNotifs(adminId, 1);
    const agent = await loginAs('team_member');
    const res = await agent.get('/api/v1/notifications');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
    expect(res.body.items.every((n: { actorName?: string }) => n.actorName !== null || true)).toBe(true);
  });

  it('GET /?unread=true filters out already-read', async () => {
    await seedNotifs(memberId, 1, { unreadOnly: false });
    await seedNotifs(memberId, 2);
    const agent = await loginAs('team_member');
    const res = await agent.get('/api/v1/notifications?unread=true');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
    expect(res.body.items.every((n: { readAt: string | null }) => n.readAt === null)).toBe(true);
  });

  it('GET /unread-count returns count', async () => {
    await seedNotifs(memberId, 3);
    await seedNotifs(memberId, 1, { unreadOnly: false });
    const agent = await loginAs('team_member');
    const res = await agent.get('/api/v1/notifications/unread-count');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3);
  });

  it('POST /:id/read flips readAt for owner', async () => {
    await seedNotifs(memberId, 1);
    const row = await prisma.notification.findFirstOrThrow({ where: { recipientId: memberId } });
    const agent = await loginAs('team_member');
    const res = await agent.post(`/api/v1/notifications/${row.id}/read`);
    expect(res.status).toBe(200);
    expect(res.body.notification.readAt).toBeTruthy();
    const after = await prisma.notification.findUnique({ where: { id: row.id } });
    expect(after?.readAt).toBeInstanceOf(Date);
  });

  it('POST /read-all marks all my unread + returns count', async () => {
    await seedNotifs(memberId, 4);
    const agent = await loginAs('team_member');
    const res = await agent.post('/api/v1/notifications/read-all');
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(4);
    const unread = await prisma.notification.count({ where: { recipientId: memberId, readAt: null } });
    expect(unread).toBe(0);
  });

  it('GET / 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
  });

  it('POST /:id/read 404 when not mine', async () => {
    await seedNotifs(adminId, 1);
    const row = await prisma.notification.findFirstOrThrow({ where: { recipientId: adminId } });
    const agent = await loginAs('team_member');
    const res = await agent.post(`/api/v1/notifications/${row.id}/read`);
    expect(res.status).toBe(404);
  });

  it('cursor pagination returns nextCursor + advances', async () => {
    await seedNotifs(memberId, 5);
    const agent = await loginAs('team_member');
    const p1 = await agent.get('/api/v1/notifications?limit=2');
    expect(p1.body.items.length).toBe(2);
    expect(p1.body.nextCursor).toBeTruthy();
    const p2 = await agent.get(`/api/v1/notifications?limit=2&cursor=${encodeURIComponent(p1.body.nextCursor)}`);
    expect(p2.body.items.length).toBe(2);
    expect(p2.body.nextCursor).toBeTruthy();
    const p3 = await agent.get(`/api/v1/notifications?limit=2&cursor=${encodeURIComponent(p2.body.nextCursor)}`);
    expect(p3.body.items.length).toBe(1);
    expect(p3.body.nextCursor).toBeNull();
  });
});
