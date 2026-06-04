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

maybe('dashboard routes', () => {
  const ORIGINAL_ENV = { ...process.env };
  let app: import('express').Express;
  let projectId: string;
  let pmId: string;
  let memberId: string;

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
    const member = await prisma.user.findUniqueOrThrow({ where: { email: 'member@demo.local' } });
    pmId = pm.id;
    memberId = member.id;

    const p = await prisma.project.create({
      data: { name: `dash-rt-${Date.now()}`, deadline: future(30), createdBy: pmId },
    });
    projectId = p.id;
    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: pmId, role: 'pm' },
        { projectId, userId: memberId, role: 'member' },
      ],
    });
    await prisma.task.createMany({
      data: [
        { projectId, title: 'rt1', dueDate: future(2), status: 'todo', priority: 'high', assignedTo: memberId, createdBy: pmId },
        { projectId, title: 'rt2', dueDate: future(5), status: 'in_progress', priority: 'medium', assignedTo: pmId, createdBy: pmId },
        { projectId, title: 'rt3', dueDate: future(1), status: 'completed', priority: 'low', createdBy: pmId },
      ],
    });
  });

  afterAll(async () => {
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await disconnectPrisma();
    process.env = ORIGINAL_ENV;
  });

  describe('global', () => {
    it('GET /api/v1/dashboard/kpis → 200 w/ shape', async () => {
      const agent = await loginAs('admin');
      const r = await agent.get('/api/v1/dashboard/kpis');
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({
        totalProjects: expect.any(Number),
        totalTasks: expect.any(Number),
        completedTasks: expect.any(Number),
        completionPct: expect.any(Number),
        myOpenTasks: expect.any(Number),
      });
    });

    it('GET /api/v1/dashboard/status → 200 w/ keys', async () => {
      const agent = await loginAs('admin');
      const r = await agent.get('/api/v1/dashboard/status');
      expect(r.status).toBe(200);
      expect(r.body).toHaveProperty('todo');
      expect(r.body).toHaveProperty('in_progress');
      expect(r.body).toHaveProperty('completed');
    });

    it('GET /api/v1/dashboard/priority → 200 w/ keys', async () => {
      const agent = await loginAs('admin');
      const r = await agent.get('/api/v1/dashboard/priority');
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ low: expect.any(Number), medium: expect.any(Number), high: expect.any(Number) });
    });

    it('GET /api/v1/dashboard/productivity → 200 w/ {data: ProductivityPoint[]}', async () => {
      const agent = await loginAs('admin');
      const r = await agent.get('/api/v1/dashboard/productivity?days=7');
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body.data)).toBe(true);
      expect(r.body.data.length).toBe(7);
    });

    it('GET /api/v1/dashboard/upcoming → 200 w/ {tasks, projects}', async () => {
      const agent = await loginAs('admin');
      const r = await agent.get('/api/v1/dashboard/upcoming?days=7');
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body.tasks)).toBe(true);
      expect(Array.isArray(r.body.projects)).toBe(true);
    });

    it('GET /api/v1/dashboard/high-priority → 200 w/ {data: []}', async () => {
      const agent = await loginAs('admin');
      const r = await agent.get('/api/v1/dashboard/high-priority');
      expect(r.status).toBe(200);
      expect(Array.isArray(r.body.data)).toBe(true);
    });
  });

  describe('per-project', () => {
    it('admin can hit /projects/:id/dashboard/kpis (admin bypass)', async () => {
      const agent = await loginAs('admin');
      const r = await agent.get(`/api/v1/projects/${projectId}/dashboard/kpis`);
      expect(r.status).toBe(200);
      expect(r.body.totalProjects).toBe(1);
      expect(r.body.totalTasks).toBe(3);
    });

    it('project pm can hit scoped status', async () => {
      const agent = await loginAs('project_manager');
      const r = await agent.get(`/api/v1/projects/${projectId}/dashboard/status`);
      expect(r.status).toBe(200);
      expect(r.body.todo).toBe(1);
      expect(r.body.in_progress).toBe(1);
      expect(r.body.completed).toBe(1);
    });

    it('project member can hit scoped priority', async () => {
      const agent = await loginAs('team_member');
      const r = await agent.get(`/api/v1/projects/${projectId}/dashboard/priority`);
      expect(r.status).toBe(200);
      expect(r.body.high).toBe(1);
    });

    it('scoped productivity returns N=days length', async () => {
      const agent = await loginAs('admin');
      const r = await agent.get(`/api/v1/projects/${projectId}/dashboard/productivity?days=14`);
      expect(r.status).toBe(200);
      expect(r.body.data.length).toBe(14);
    });

    it('scoped upcoming returns only this project items', async () => {
      const agent = await loginAs('admin');
      const r = await agent.get(`/api/v1/projects/${projectId}/dashboard/upcoming?days=7`);
      expect(r.status).toBe(200);
      expect(r.body.tasks.every((t: { projectId: string }) => t.projectId === projectId)).toBe(true);
    });

    it('scoped high-priority returns only project items', async () => {
      const agent = await loginAs('admin');
      const r = await agent.get(`/api/v1/projects/${projectId}/dashboard/high-priority`);
      expect(r.status).toBe(200);
      expect(r.body.data.every((t: { projectId: string }) => t.projectId === projectId)).toBe(true);
    });
  });
});
