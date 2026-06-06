import request from 'supertest';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { seedDemoUsers } from '../../../../../prisma/seed';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const SECRET = 'x'.repeat(40);
const DEMO_EMAILS = ['admin@demo.local', 'pm@demo.local', 'member@demo.local'];
const future = (days = 7) => new Date(Date.now() + days * 86_400_000);

const setupEnv = () => {
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
};

maybe('activity routes (global)', () => {
  let app: import('express').Express;
  let pmId: string;
  let projectId: string;

  const loginAs = async (role: 'admin' | 'project_manager' | 'team_member') => {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/demo-login').send({ role });
    expect(res.status).toBe(200);
    return agent;
  };

  beforeAll(async () => {
    setupEnv();
    jest.resetModules();
    const mod = await import('../../../../app');
    app = mod.default;

    await prisma.activityLog.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await seedDemoUsers(prisma);

    const pm = await prisma.user.findUniqueOrThrow({ where: { email: 'pm@demo.local' } });
    pmId = pm.id;
    const p = await prisma.project.create({
      data: { name: `act-rt-${Date.now()}`, deadline: future(30), createdBy: pmId },
    });
    projectId = p.id;
    await prisma.projectMember.create({
      data: { projectId, userId: pmId, role: 'pm' },
    });
    for (let i = 0; i < 15; i++) {
      await prisma.activityLog.create({
        data: {
          actorId: pmId,
          action: 'task.created',
          entityType: 'task',
          entityId: projectId,
          projectId,
          meta: { title: `T${i}` },
        },
      });
      await new Promise((r) => setTimeout(r, 2));
    }
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await disconnectPrisma();
  });

  it('GET /api/v1/activity returns items + nextCursor', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent.get('/api/v1/activity');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(10);
    expect(res.body.nextCursor).not.toBeNull();
  });

  it('GET /api/v1/activity returns 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/v1/activity');
    expect(res.status).toBe(401);
  });

  it('honours limit=5', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent.get('/api/v1/activity?limit=5');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(5);
  });

  it('paginates with cursor', async () => {
    const agent = await loginAs('project_manager');
    const page1 = await agent.get('/api/v1/activity?limit=5');
    const page2 = await agent.get(`/api/v1/activity?limit=5&cursor=${encodeURIComponent(page1.body.nextCursor)}`);
    expect(page2.status).toBe(200);
    const overlap = page2.body.items.filter((i: { id: string }) =>
      page1.body.items.some((p: { id: string }) => p.id === i.id),
    );
    expect(overlap.length).toBe(0);
  });

  it('rejects limit=0 with 422', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent.get('/api/v1/activity?limit=0');
    expect(res.status).toBe(422);
  });

  it('default limit is 10', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent.get('/api/v1/activity');
    expect(res.body.items.length).toBe(10);
  });

  it('rejects malformed cursor with 422 INVALID_CURSOR', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent.get('/api/v1/activity?cursor=not-a-real-cursor');
    expect(res.status).toBe(422);
    expect(res.body.code ?? res.body.error?.code).toBe('INVALID_CURSOR');
  });
});
