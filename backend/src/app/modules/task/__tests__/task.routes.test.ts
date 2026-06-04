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

maybe('task routes /api/v1/tasks (t7 happy paths)', () => {
  const ORIGINAL_ENV = { ...process.env };
  let app: import('express').Express;
  let projectId: string;
  let adminId: string;
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
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await seedDemoUsers(prisma);

    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@demo.local' } });
    const pm = await prisma.user.findUniqueOrThrow({ where: { email: 'pm@demo.local' } });
    const member = await prisma.user.findUniqueOrThrow({ where: { email: 'member@demo.local' } });
    adminId = admin.id;
    pmId = pm.id;
    memberId = member.id;

    const p = await prisma.project.create({
      data: { name: 'T7 Routes Project', deadline: new Date(future(60)), status: 'active', createdBy: adminId },
    });
    projectId = p.id;
  });

  afterAll(async () => {
    await prisma.task.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await disconnectPrisma();
    process.env = ORIGINAL_ENV;
  });

  beforeEach(async () => {
    await prisma.task.deleteMany({});
  });

  it('admin creates -> 201 with task + creator + assignee', async () => {
    const agent = await loginAs('admin');
    const res = await agent.post('/api/v1/tasks').send({
      projectId,
      title: 'Admin Task',
      dueDate: future(),
      assignedTo: pmId,
    });
    expect(res.status).toBe(201);
    expect(res.body.task.title).toBe('Admin Task');
    expect(res.body.task.createdBy).toBe(adminId);
    expect(res.body.task.creator).toMatchObject({ email: 'admin@demo.local' });
    expect(res.body.task.assignee).toMatchObject({ email: 'pm@demo.local' });
    expect(res.body.task.status).toBe('todo');
    expect(res.body.task.priority).toBe('medium');
  });

  it('member creates -> 201 (members can create)', async () => {
    const agent = await loginAs('team_member');
    const res = await agent.post('/api/v1/tasks').send({
      projectId,
      title: 'Member Task',
      dueDate: future(),
    });
    expect(res.status).toBe(201);
    expect(res.body.task.createdBy).toBe(memberId);
  });

  it('all roles list -> 200 + includes embedded relations', async () => {
    const adminAgent = await loginAs('admin');
    await adminAgent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Shared', dueDate: future(), assignedTo: memberId })
      .expect(201);

    for (const role of ['admin', 'project_manager', 'team_member'] as const) {
      const agent = await loginAs(role);
      const res = await agent.get(`/api/v1/tasks?projectId=${projectId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].creator).toMatchObject({ email: 'admin@demo.local' });
      expect(res.body.data[0].assignee).toMatchObject({ email: 'member@demo.local' });
    }
  });

  it('member edits own task (createdBy=self) -> 200', async () => {
    const agent = await loginAs('team_member');
    const created = await agent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Own Task', dueDate: future() });
    expect(created.status).toBe(201);
    const res = await agent
      .patch(`/api/v1/tasks/${created.body.task.id}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body.task.status).toBe('in_progress');
  });

  it('member edits task assigned to them (assignedTo=self) -> 200', async () => {
    const adminAgent = await loginAs('admin');
    const created = await adminAgent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Assigned to Member', dueDate: future(), assignedTo: memberId });
    expect(created.status).toBe(201);

    const memberAgent = await loginAs('team_member');
    const res = await memberAgent
      .patch(`/api/v1/tasks/${created.body.task.id}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
  });

  it('admin deletes -> 204; subsequent GET -> 404', async () => {
    const agent = await loginAs('admin');
    const created = await agent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'Delete me', dueDate: future() });
    const id = created.body.task.id;
    const del = await agent.delete(`/api/v1/tasks/${id}`);
    expect(del.status).toBe(204);
    const get = await agent.get(`/api/v1/tasks/${id}`);
    expect(get.status).toBe(404);
    expect(get.body.error.code).toBe('TASK_NOT_FOUND');
  });

  it('PM deletes -> 204', async () => {
    const adminAgent = await loginAs('admin');
    const created = await adminAgent
      .post('/api/v1/tasks')
      .send({ projectId, title: 'PM can delete', dueDate: future() });
    const pmAgent = await loginAs('project_manager');
    const res = await pmAgent.delete(`/api/v1/tasks/${created.body.task.id}`);
    expect(res.status).toBe(204);
  });

  it('list filters apply via query string (status + priority + assignedTo)', async () => {
    const agent = await loginAs('admin');
    await agent
      .post('/api/v1/tasks')
      .send({
        projectId,
        title: 'High Todo Assigned',
        dueDate: future(2),
        priority: 'high',
        assignedTo: memberId,
      })
      .expect(201);
    await agent
      .post('/api/v1/tasks')
      .send({
        projectId,
        title: 'Low Todo Unassigned',
        dueDate: future(5),
        priority: 'low',
      })
      .expect(201);

    const res = await agent.get(
      `/api/v1/tasks?projectId=${projectId}&status=todo&priority=high&assignedTo=${memberId}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].priority).toBe('high');
  });
});
