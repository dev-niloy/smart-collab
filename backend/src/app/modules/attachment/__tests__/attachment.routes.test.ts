import path from 'node:path';
import os from 'node:os';
import fsp from 'node:fs/promises';
import request from 'supertest';

const TMP_UPLOAD_DIR = path.join(os.tmpdir(), `extras-routes-${process.pid}`);
process.env.UPLOAD_DIR = TMP_UPLOAD_DIR;

import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { seedDemoUsers } from '../../../../../prisma/seed';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;
const SECRET = 'x'.repeat(40);
const DEMO_EMAILS = ['admin@demo.local', 'pm@demo.local', 'member@demo.local'];
const future = (days = 7) => new Date(Date.now() + days * 86_400_000).toISOString();

maybe('attachment routes', () => {
  const ORIGINAL_ENV = { ...process.env };
  let app: import('express').Express;
  let taskId: string;
  let projectId: string;
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
      email: 'stranger-att@demo.local',
      password: 'stranger-pw',
    });
    expect(res.status).toBe(200);
    return agent;
  };

  beforeAll(async () => {
    await fsp.mkdir(TMP_UPLOAD_DIR, { recursive: true });
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
      UPLOAD_DIR: TMP_UPLOAD_DIR,
    });
    jest.resetModules();
    const mod = await import('../../../../app');
    app = mod.default;

    await prisma.activityLog.deleteMany({ where: { entityType: 'attachment' } });
    await prisma.attachment.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { in: [...DEMO_EMAILS, 'stranger-att@demo.local'] } } });
    await seedDemoUsers(prisma);

    const bcrypt = await import('bcrypt');
    const stranger = await prisma.user.create({
      data: {
        email: 'stranger-att@demo.local',
        name: 'Stranger',
        passwordHash: await bcrypt.hash('stranger-pw', 4),
        role: 'team_member',
      },
    });
    strangerId = stranger.id;

    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@demo.local' } });
    const member = await prisma.user.findUniqueOrThrow({ where: { email: 'member@demo.local' } });
    const pm = await prisma.user.findUniqueOrThrow({ where: { email: 'pm@demo.local' } });

    projectId = (await prisma.project.create({
      data: { name: 'Att Routes Proj', deadline: new Date(future(60)), status: 'active', createdBy: admin.id },
    })).id;
    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: pm.id, role: 'pm' },
        { projectId, userId: member.id, role: 'member' },
      ],
    });
    taskId = (await prisma.task.create({
      data: { projectId, title: 'Att routes task', dueDate: new Date(future()), createdBy: admin.id },
    })).id;
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { entityType: 'attachment' } });
    await prisma.attachment.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.projectMember.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.user.deleteMany({ where: { id: strangerId } });
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await fsp.rm(TMP_UPLOAD_DIR, { recursive: true, force: true });
    await disconnectPrisma();
    process.env = ORIGINAL_ENV;
  });

  beforeEach(async () => {
    await prisma.activityLog.deleteMany({ where: { entityType: 'attachment' } });
    await prisma.attachment.deleteMany({ where: { taskId } });
  });

  it('POST 201 multipart returns attachment DTO', async () => {
    const agent = await loginAs('team_member');
    const res = await agent
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .attach('file', Buffer.from('hello world'), { filename: 'hello.txt', contentType: 'text/plain' });
    expect(res.status).toBe(201);
    expect(res.body.attachment.filename).toBe('hello.txt');
    expect(res.body.attachment.mimeType).toBe('text/plain');
  });

  it('GET 200 lists attachments for a task', async () => {
    const agent = await loginAs('team_member');
    await agent
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .attach('file', Buffer.from('listed'), { filename: 'list.txt', contentType: 'text/plain' });
    const res = await agent.get(`/api/v1/tasks/${taskId}/attachments`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].filename).toBe('list.txt');
  });

  it('GET /api/v1/attachments/file/:id streams content w/ correct headers', async () => {
    const agent = await loginAs('team_member');
    const up = await agent
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .attach('file', Buffer.from('streaming body'), {
        filename: 'stream.txt',
        contentType: 'text/plain',
      });
    const id = up.body.attachment.id;
    const dl = await agent.get(`/api/v1/attachments/file/${id}`);
    expect(dl.status).toBe(200);
    expect(dl.headers['content-type']).toContain('text/plain');
    expect(dl.headers['content-disposition']).toContain('stream.txt');
    expect(dl.text).toBe('streaming body');
  });

  it('GET /api/v1/attachments/file/:id 401 when not authenticated', async () => {
    const agent = await loginAs('team_member');
    const up = await agent
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .attach('file', Buffer.from('private'), { filename: 'priv.txt', contentType: 'text/plain' });
    const id = up.body.attachment.id;
    const anon = request(app);
    const res = await anon.get(`/api/v1/attachments/file/${id}`);
    expect(res.status).toBe(401);
  });

  it('DELETE 204 by uploader', async () => {
    const agent = await loginAs('team_member');
    const up = await agent
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .attach('file', Buffer.from('del'), { filename: 'del.txt', contentType: 'text/plain' });
    const id = up.body.attachment.id;
    const res = await agent.delete(`/api/v1/tasks/${taskId}/attachments/${id}`);
    expect(res.status).toBe(204);
  });

  it('DELETE 403 by stranger (not in project)', async () => {
    const agent = await loginAs('team_member');
    const up = await agent
      .post(`/api/v1/tasks/${taskId}/attachments`)
      .attach('file', Buffer.from('safe'), { filename: 'safe.txt', contentType: 'text/plain' });
    const id = up.body.attachment.id;
    const stranger = await loginAsStranger();
    const res = await stranger.delete(`/api/v1/tasks/${taskId}/attachments/${id}`);
    expect(res.status).toBe(403);
  });
});
