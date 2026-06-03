import request from 'supertest';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { seedDemoUsers } from '../../../../../prisma/seed';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const SECRET = 'x'.repeat(40);

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

const DEMO_EMAILS = ['admin@demo.local', 'pm@demo.local', 'member@demo.local'];

const future = (days = 7) => new Date(Date.now() + days * 86_400_000).toISOString();
const past = () => new Date(Date.now() - 86_400_000).toISOString();

maybe('project routes /api/v1/projects', () => {
  const ORIGINAL_ENV = { ...process.env };
  let app: import('express').Express;

  const loginAs = async (role: 'admin' | 'project_manager' | 'team_member') => {
    const agent = request.agent(app);
    const roleMap = { admin: 'admin', project_manager: 'project_manager', team_member: 'team_member' } as const;
    const res = await agent.post('/api/v1/auth/demo-login').send({ role: roleMap[role] });
    expect(res.status).toBe(200);
    return agent;
  };

  beforeAll(async () => {
    setupEnv();
    jest.resetModules();
    const mod = await import('../../../../app');
    app = mod.default;
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await seedDemoUsers(prisma);
  });

  afterAll(async () => {
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await disconnectPrisma();
    process.env = ORIGINAL_ENV;
  });

  beforeEach(async () => {
    await prisma.project.deleteMany({});
  });

  it('unauthenticated → 401 on list', async () => {
    const res = await request(app).get('/api/v1/projects');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  it('admin creates → 201 with project + createdBy', async () => {
    const agent = await loginAs('admin');
    const res = await agent
      .post('/api/v1/projects')
      .send({ name: 'Launch Site', deadline: future(), description: 'd', status: 'active' });
    expect(res.status).toBe(201);
    expect(res.body.project.name).toBe('Launch Site');
    expect(res.body.project.createdBy).toBeTruthy();
    expect(res.body.project.status).toBe('active');
  });

  it('PM creates → 201', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent
      .post('/api/v1/projects')
      .send({ name: 'PM Project', deadline: future() });
    expect(res.status).toBe(201);
  });

  it('member create → 403 FORBIDDEN_ROLE', async () => {
    const agent = await loginAs('team_member');
    const res = await agent
      .post('/api/v1/projects')
      .send({ name: 'Nope', deadline: future() });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('create with past deadline → 422 PAST_DEADLINE', async () => {
    const agent = await loginAs('admin');
    const res = await agent
      .post('/api/v1/projects')
      .send({ name: 'Late', deadline: past() });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAST_DEADLINE');
    expect(res.body.error.message).toBe('Please select a valid deadline.');
  });

  it('create with invalid body → 422 VALIDATION_ERROR', async () => {
    const agent = await loginAs('admin');
    const res = await agent.post('/api/v1/projects').send({ name: '', deadline: 'not-a-date' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('all roles can list', async () => {
    const adminAgent = await loginAs('admin');
    await adminAgent
      .post('/api/v1/projects')
      .send({ name: 'Shared', deadline: future() })
      .expect(201);

    for (const role of ['admin', 'project_manager', 'team_member'] as const) {
      const agent = await loginAs(role);
      const res = await agent.get('/api/v1/projects');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.total).toBe(1);
    }
  });

  it('admin updates → 200', async () => {
    const agent = await loginAs('admin');
    const created = await agent
      .post('/api/v1/projects')
      .send({ name: 'Old', deadline: future() });
    const id = created.body.project.id;
    const res = await agent
      .patch(`/api/v1/projects/${id}`)
      .send({ name: 'New', status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('New');
    expect(res.body.project.status).toBe('completed');
  });

  it('member update → 403', async () => {
    const adminAgent = await loginAs('admin');
    const created = await adminAgent
      .post('/api/v1/projects')
      .send({ name: 'X', deadline: future() });
    const id = created.body.project.id;
    const memberAgent = await loginAs('team_member');
    const res = await memberAgent.patch(`/api/v1/projects/${id}`).send({ name: 'Hack' });
    expect(res.status).toBe(403);
  });

  it('update missing id → 404', async () => {
    const agent = await loginAs('admin');
    const res = await agent
      .patch('/api/v1/projects/00000000-0000-0000-0000-000000000000')
      .send({ name: 'X' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
  });

  it('admin deletes → 204; subsequent get → 404', async () => {
    const agent = await loginAs('admin');
    const created = await agent
      .post('/api/v1/projects')
      .send({ name: 'Delete me', deadline: future() });
    const id = created.body.project.id;
    const del = await agent.delete(`/api/v1/projects/${id}`);
    expect(del.status).toBe(204);
    const get = await agent.get(`/api/v1/projects/${id}`);
    expect(get.status).toBe(404);
  });

  it('member delete → 403', async () => {
    const adminAgent = await loginAs('admin');
    const created = await adminAgent
      .post('/api/v1/projects')
      .send({ name: 'X', deadline: future() });
    const id = created.body.project.id;
    const memberAgent = await loginAs('team_member');
    const res = await memberAgent.delete(`/api/v1/projects/${id}`);
    expect(res.status).toBe(403);
  });

  it('get by invalid uuid → 422 VALIDATION_ERROR', async () => {
    const agent = await loginAs('admin');
    const res = await agent.get('/api/v1/projects/not-a-uuid');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
