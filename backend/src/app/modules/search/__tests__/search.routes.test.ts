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

maybe('search routes', () => {
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

    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await seedDemoUsers(prisma);

    const pm = await prisma.user.findUniqueOrThrow({ where: { email: 'pm@demo.local' } });
    pmId = pm.id;
    const p = await prisma.project.create({
      data: { name: `SearchRoute Alpha`, deadline: future(30), createdBy: pmId },
    });
    projectId = p.id;
    await prisma.projectMember.create({ data: { projectId, userId: pmId, role: 'pm' } });
    await prisma.task.create({
      data: {
        projectId,
        title: 'fix login bug',
        dueDate: future(2),
        createdBy: pmId,
      },
    });
  });

  afterAll(async () => {
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await disconnectPrisma();
  });

  it('GET /api/v1/search?q=Alpha returns 200 + shape', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent.get('/api/v1/search?q=Alpha');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.projects)).toBe(true);
    expect(Array.isArray(res.body.tasks)).toBe(true);
    expect(res.body.projects.some((p: { id: string }) => p.id === projectId)).toBe(true);
  });

  it('401 when unauthenticated', async () => {
    const res = await request(app).get('/api/v1/search?q=Alpha');
    expect(res.status).toBe(401);
  });

  it('422 when q omitted', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent.get('/api/v1/search');
    expect(res.status).toBe(422);
  });

  it('422 when q.length < 2', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent.get('/api/v1/search?q=a');
    expect(res.status).toBe(422);
  });

  it('422 when limit=21', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent.get('/api/v1/search?q=Alpha&limit=21');
    expect(res.status).toBe(422);
  });

  it('finds task hits + returns combined results', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent.get('/api/v1/search?q=login');
    expect(res.status).toBe(200);
    expect(res.body.tasks.some((t: { title: string }) => t.title === 'fix login bug')).toBe(true);
  });
});
