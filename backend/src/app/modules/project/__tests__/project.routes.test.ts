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
    expect(res.body.project.creator).toMatchObject({ email: 'admin@demo.local' });
    expect(res.body.project.creator.name).toBe('Demo Admin');
  });

  it('PM creates → 201', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent
      .post('/api/v1/projects')
      .send({ name: 'PM Project', deadline: future() });
    expect(res.status).toBe(201);
  });

  it('create → auto-pm member visible via GET /:id/members (e2e auto-PM verification)', async () => {
    const agent = await loginAs('project_manager');
    const create = await agent
      .post('/api/v1/projects')
      .send({ name: 'Auto-PM E2E', deadline: future() });
    expect(create.status).toBe(201);
    const projectId = create.body.project.id;
    const members = await agent.get(`/api/v1/projects/${projectId}/members`);
    expect(members.status).toBe(200);
    expect(members.body.data.length).toBe(1);
    expect(members.body.data[0].role).toBe('pm');
    expect(members.body.data[0].user.email).toBe('pm@demo.local');
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

  it('admin sees all projects; non-member pm/member see filtered list (RBAC)', async () => {
    const adminAgent = await loginAs('admin');
    await adminAgent
      .post('/api/v1/projects')
      .send({ name: 'Shared', deadline: future() })
      .expect(201);

    const adminRes = await adminAgent.get('/api/v1/projects');
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.data.length).toBe(1);
    expect(adminRes.body.data[0].creator).toMatchObject({ email: 'admin@demo.local' });

    for (const role of ['project_manager', 'team_member'] as const) {
      const agent = await loginAs(role);
      const res = await agent.get('/api/v1/projects');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
      expect(res.body.total).toBe(0);
    }
  });

  it('pm can list their own freshly-created project (creator-auto-pm invariant)', async () => {
    const agent = await loginAs('project_manager');
    const created = await agent
      .post('/api/v1/projects')
      .send({ name: 'PM-Created', deadline: future() })
      .expect(201);
    expect(created.body.project.id).toBeDefined();

    const res = await agent.get('/api/v1/projects');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('PM-Created');
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

  it('list pagination cap: limit=999 coerced to MAX_LIMIT=50', async () => {
    const agent = await loginAs('admin');
    for (let i = 0; i < 3; i++) {
      await agent
        .post('/api/v1/projects')
        .send({ name: `P${i}`, deadline: future(7 + i) })
        .expect(201);
    }
    const res = await agent.get('/api/v1/projects?limit=999');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(50);
    expect(res.body.total).toBe(3);
  });

  it('list with q + status + sort=deadline filters/sorts correctly', async () => {
    const agent = await loginAs('admin');
    await agent
      .post('/api/v1/projects')
      .send({ name: 'Alpha Site', deadline: future(30), status: 'active' })
      .expect(201);
    await agent
      .post('/api/v1/projects')
      .send({ name: 'Alpha Brand', deadline: future(5), status: 'active' })
      .expect(201);
    await agent
      .post('/api/v1/projects')
      .send({ name: 'Beta Onboarding', deadline: future(2), status: 'completed' })
      .expect(201);
    const res = await agent.get('/api/v1/projects?q=alpha&status=active&sort=deadline');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].name).toBe('Alpha Brand');
    expect(res.body.data[1].name).toBe('Alpha Site');
  });

  it('PATCH past deadline → 422 PAST_DEADLINE with assessment-verbatim message', async () => {
    const agent = await loginAs('admin');
    const created = await agent
      .post('/api/v1/projects')
      .send({ name: 'Future then past', deadline: future() })
      .expect(201);
    const res = await agent
      .patch(`/api/v1/projects/${created.body.project.id}`)
      .send({ deadline: past() });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAST_DEADLINE');
    expect(res.body.error.message).toBe('Please select a valid deadline.');
  });

  it('GET unknown id → 404 PROJECT_NOT_FOUND', async () => {
    const agent = await loginAs('admin');
    const res = await agent.get('/api/v1/projects/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
  });

  it('DELETE unknown id → 404 PROJECT_NOT_FOUND', async () => {
    const agent = await loginAs('admin');
    const res = await agent.delete('/api/v1/projects/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
  });

  // ── t11: nested GET /:id/tasks convenience route ─────────────────────────

  it('GET /:id/tasks returns paginated tasks scoped to project', async () => {
    const agent = await loginAs('admin');
    const proj = await agent
      .post('/api/v1/projects')
      .send({ name: 'NestedTasksProj', deadline: future() });
    const pid = proj.body.project.id;
    await agent
      .post('/api/v1/tasks')
      .send({ projectId: pid, title: 'Nested A', dueDate: future(2) })
      .expect(201);
    await agent
      .post('/api/v1/tasks')
      .send({ projectId: pid, title: 'Nested B', dueDate: future(3) })
      .expect(201);

    const res = await agent.get(`/api/v1/projects/${pid}/tasks`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.every((t: { projectId: string }) => t.projectId === pid)).toBe(true);
  });

  it('GET /:id/tasks for unknown project -> 404 PROJECT_NOT_FOUND', async () => {
    const agent = await loginAs('admin');
    const res = await agent.get(
      '/api/v1/projects/00000000-0000-0000-0000-000000000000/tasks',
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROJECT_NOT_FOUND');
  });

  it('GET /:id/tasks unauth -> 401', async () => {
    const res = await request(app).get(
      '/api/v1/projects/00000000-0000-0000-0000-000000000000/tasks',
    );
    expect(res.status).toBe(401);
  });

  it('GET /:id/tasks honors query filters (status)', async () => {
    const agent = await loginAs('admin');
    const proj = await agent
      .post('/api/v1/projects')
      .send({ name: 'NestedFilterProj', deadline: future() });
    const pid = proj.body.project.id;
    await agent
      .post('/api/v1/tasks')
      .send({ projectId: pid, title: 'T1', dueDate: future(2), status: 'todo' })
      .expect(201);
    await agent
      .post('/api/v1/tasks')
      .send({ projectId: pid, title: 'T2', dueDate: future(3), status: 'in_progress' })
      .expect(201);
    const res = await agent.get(`/api/v1/projects/${pid}/tasks?status=in_progress`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].status).toBe('in_progress');
  });
});
