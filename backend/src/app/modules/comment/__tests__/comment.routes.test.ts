import request from 'supertest';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { seedDemoUsers } from '../../../../../prisma/seed';
import { MAX_COMMENT_BODY } from '../comment.constant';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const SECRET = 'x'.repeat(40);
const DEMO_EMAILS = ['admin@demo.local', 'pm@demo.local', 'member@demo.local'];
const future = (days = 7) => new Date(Date.now() + days * 86_400_000).toISOString();

maybe('comment routes /api/v1/tasks/:taskId/comments', () => {
  const ORIGINAL_ENV = { ...process.env };
  let app: import('express').Express;
  let projectId: string;
  let taskId: string;
  let pmId: string;
  let memberId: string;
  let strangerId: string;

  const loginAs = async (role: 'admin' | 'project_manager' | 'team_member') => {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/demo-login').send({ role });
    expect(res.status).toBe(200);
    return agent;
  };

  const loginAsStranger = async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/login').send({
      email: 'stranger@demo.local',
      password: 'stranger-pw',
    });
    expect(res.status).toBe(200);
    return agent;
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

    await prisma.activityLog.deleteMany({ where: { entityType: 'comment' } });
    await prisma.comment.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: [...DEMO_EMAILS, 'stranger@demo.local'] } } });
    await seedDemoUsers(prisma);

    const bcrypt = await import('bcrypt');
    const stranger = await prisma.user.create({
      data: {
        email: 'stranger@demo.local',
        name: 'Stranger',
        passwordHash: await bcrypt.hash('stranger-pw', 4),
        role: 'team_member',
      },
    });
    strangerId = stranger.id;

    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@demo.local' } });
    const pm = await prisma.user.findUniqueOrThrow({ where: { email: 'pm@demo.local' } });
    const member = await prisma.user.findUniqueOrThrow({ where: { email: 'member@demo.local' } });
    pmId = pm.id;
    memberId = member.id;

    const p = await prisma.project.create({
      data: { name: 'Comment Routes Project', deadline: new Date(future(60)), status: 'active', createdBy: admin.id },
    });
    projectId = p.id;
    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: pmId, role: 'pm' },
        { projectId, userId: memberId, role: 'member' },
      ],
    });
    const t = await prisma.task.create({
      data: { projectId, title: 'Comment routes task', dueDate: new Date(future()), createdBy: admin.id },
    });
    taskId = t.id;
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { entityType: 'comment' } });
    await prisma.comment.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { id: strangerId } });
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await disconnectPrisma();
    process.env = ORIGINAL_ENV;
  });

  beforeEach(async () => {
    await prisma.activityLog.deleteMany({ where: { entityType: 'comment' } });
    await prisma.comment.deleteMany({ where: { taskId } });
  });

  it('POST 201 returns comment DTO', async () => {
    const agent = await loginAs('team_member');
    const res = await agent.post(`/api/v1/tasks/${taskId}/comments`).send({ body: 'hello world' });
    expect(res.status).toBe(201);
    expect(res.body.comment.body).toBe('hello world');
    expect(res.body.comment.author).toMatchObject({ id: memberId, name: expect.any(String) });
  });

  it('GET 200 returns list with nextCursor when over limit', async () => {
    const member = await loginAs('team_member');
    for (let i = 0; i < 3; i += 1) {
      await member.post(`/api/v1/tasks/${taskId}/comments`).send({ body: `c${i}` });
      await new Promise((r) => setTimeout(r, 5));
    }
    const res = await member.get(`/api/v1/tasks/${taskId}/comments?limit=2`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
    expect(res.body.items[0].body).toBe('c2');
    expect(res.body.nextCursor).toBeTruthy();
  });

  it('PATCH 200 by author (member edits own)', async () => {
    const member = await loginAs('team_member');
    const created = await member.post(`/api/v1/tasks/${taskId}/comments`).send({ body: 'mine' });
    const id = created.body.comment.id;
    const res = await member.patch(`/api/v1/tasks/${taskId}/comments/${id}`).send({ body: 'edited' });
    expect(res.status).toBe(200);
    expect(res.body.comment.body).toBe('edited');
  });

  it('PATCH 403 when caller is project member but not author', async () => {
    const member = await loginAs('team_member');
    const created = await member.post(`/api/v1/tasks/${taskId}/comments`).send({ body: 'mine' });
    const id = created.body.comment.id;
    const pm = await loginAs('project_manager');
    const res = await pm.patch(`/api/v1/tasks/${taskId}/comments/${id}`).send({ body: 'no' });
    expect(res.status).toBe(403);
  });

  it('DELETE 204 by author', async () => {
    const member = await loginAs('team_member');
    const created = await member.post(`/api/v1/tasks/${taskId}/comments`).send({ body: 'kill me' });
    const id = created.body.comment.id;
    const res = await member.delete(`/api/v1/tasks/${taskId}/comments/${id}`);
    expect(res.status).toBe(204);
  });

  it('DELETE 204 by PM (non-author)', async () => {
    const member = await loginAs('team_member');
    const created = await member.post(`/api/v1/tasks/${taskId}/comments`).send({ body: 'pm cleans' });
    const id = created.body.comment.id;
    const pm = await loginAs('project_manager');
    const res = await pm.delete(`/api/v1/tasks/${taskId}/comments/${id}`);
    expect(res.status).toBe(204);
  });

  it('DELETE 403 stranger member (not in project)', async () => {
    const member = await loginAs('team_member');
    const created = await member.post(`/api/v1/tasks/${taskId}/comments`).send({ body: 'safe' });
    const id = created.body.comment.id;
    const stranger = await loginAsStranger();
    const res = await stranger.delete(`/api/v1/tasks/${taskId}/comments/${id}`);
    expect(res.status).toBe(403);
  });

  it('POST 422 when body exceeds MAX_COMMENT_BODY', async () => {
    const member = await loginAs('team_member');
    const res = await member
      .post(`/api/v1/tasks/${taskId}/comments`)
      .send({ body: 'x'.repeat(MAX_COMMENT_BODY + 1) });
    expect([400, 422]).toContain(res.status);
  });

  it('GET 4xx on malformed taskId (uuid param validation, not 500)', async () => {
    const agent = await loginAs('team_member');
    const res = await agent.get('/api/v1/tasks/not-a-uuid/comments');
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
