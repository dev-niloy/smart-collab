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

maybe('projectMember routes /api/v1/projects/:id/members', () => {
  const ORIGINAL_ENV = { ...process.env };
  let app: import('express').Express;
  let projectId: string;
  let adminId: string;
  let pmId: string;
  let extraUserEmail: string;
  let extraUserId: string;

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

    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@demo.local' } });
    const pm = await prisma.user.findUniqueOrThrow({ where: { email: 'pm@demo.local' } });
    adminId = admin.id;
    pmId = pm.id;

    // Extra user for add-by-email coverage
    extraUserEmail = `pm-routes-extra-${Date.now()}@test.local`;
    const extra = await prisma.user.create({
      data: {
        email: extraUserEmail,
        name: 'Extra User',
        passwordHash: 'x',
        role: 'team_member',
      },
    });
    extraUserId = extra.id;
  });

  afterAll(async () => {
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: [...DEMO_EMAILS, extraUserEmail] } } });
    await disconnectPrisma();
    process.env = ORIGINAL_ENV;
  });

  beforeEach(async () => {
    // Fresh project per test, with pm as project pm
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    const p = await prisma.project.create({
      data: { name: `pm-routes-${Date.now()}`, deadline: future(60), createdBy: pmId },
    });
    projectId = p.id;
    await prisma.projectMember.create({ data: { projectId, userId: pmId, role: 'pm' } });
  });

  it('admin can list members (admin bypass on member-area)', async () => {
    const agent = await loginAs('admin');
    const r = await agent.get(`/api/v1/projects/${projectId}/members`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
    expect(r.body.data.length).toBe(1);
    expect(r.body.data[0].workload).toEqual({ todo: 0, in_progress: 0, completed: 0, due_soon: 0 });
  });

  it('project pm can add a member by email', async () => {
    const agent = await loginAs('project_manager');
    const r = await agent
      .post(`/api/v1/projects/${projectId}/members`)
      .send({ email: extraUserEmail, role: 'member' });
    expect(r.status).toBe(201);
    expect(r.body.member.userId).toBe(extraUserId);
    expect(r.body.member.role).toBe('member');
  });

  it('admin can add a member', async () => {
    const agent = await loginAs('admin');
    const r = await agent
      .post(`/api/v1/projects/${projectId}/members`)
      .send({ email: extraUserEmail, role: 'pm' });
    expect(r.status).toBe(201);
    expect(r.body.member.role).toBe('pm');
  });

  it('project pm can update a member role', async () => {
    const addAgent = await loginAs('project_manager');
    const addR = await addAgent
      .post(`/api/v1/projects/${projectId}/members`)
      .send({ email: extraUserEmail, role: 'member' });
    const memberRowId = addR.body.member.id;
    const r = await addAgent
      .patch(`/api/v1/projects/${projectId}/members/${memberRowId}`)
      .send({ role: 'pm' });
    expect(r.status).toBe(200);
    expect(r.body.member.role).toBe('pm');
  });

  it('project pm can remove a member; tasks get unassigned', async () => {
    const agent = await loginAs('project_manager');
    const addR = await agent
      .post(`/api/v1/projects/${projectId}/members`)
      .send({ email: extraUserEmail, role: 'member' });
    const memberRowId = addR.body.member.id;
    // Assign a task to that user
    const task = await prisma.task.create({
      data: {
        projectId,
        title: 'route-rm',
        dueDate: future(20),
        assignedTo: extraUserId,
        createdBy: pmId,
      },
    });
    const r = await agent.delete(`/api/v1/projects/${projectId}/members/${memberRowId}`);
    expect(r.status).toBe(200);
    expect(r.body.tasksUnassigned).toBe(1);
    const post = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(post.assignedTo).toBeNull();
  });

  it('GET /assignable returns members and system admins', async () => {
    const agent = await loginAs('project_manager');
    await agent
      .post(`/api/v1/projects/${projectId}/members`)
      .send({ email: extraUserEmail, role: 'member' });
    const r = await agent.get(`/api/v1/projects/${projectId}/members/assignable`);
    expect(r.status).toBe(200);
    const ids = r.body.data.map((x: { id: string }) => x.id);
    expect(ids).toContain(pmId);
    expect(ids).toContain(extraUserId);
    expect(ids).toContain(adminId); // admin always assignable
  });

  it('a project member can GET members but not POST', async () => {
    // Add the demo member user to the project first (as PM)
    const pmAgent = await loginAs('project_manager');
    await pmAgent
      .post(`/api/v1/projects/${projectId}/members`)
      .send({ email: 'member@demo.local', role: 'member' });
    const memAgent = await loginAs('team_member');
    const g = await memAgent.get(`/api/v1/projects/${projectId}/members`);
    expect(g.status).toBe(200);
    const p = await memAgent
      .post(`/api/v1/projects/${projectId}/members`)
      .send({ email: extraUserEmail, role: 'member' });
    expect(p.status).toBe(403);
    expect(p.body.error.code).toBe('FORBIDDEN_PROJECT_ROLE');
  });

  it('an unrelated member is forbidden even on GET', async () => {
    const memAgent = await loginAs('team_member');
    const g = await memAgent.get(`/api/v1/projects/${projectId}/members`);
    expect(g.status).toBe(403);
  });
});
