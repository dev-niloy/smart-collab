import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import bcrypt from 'bcrypt';

import { prisma, disconnectPrisma } from '../../../config/prisma';
import { requireAuth } from '../auth';
import { requireProjectRole } from '../requireProjectRole';
import { errorHandler } from '../errorHandler';
import { signAccessToken } from '../../modules/auth/auth.tokens';
import { ACCESS_COOKIE } from '../../modules/auth/auth.constant';

const SECRET = 'x'.repeat(40);
const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const u = (label: string) =>
  `pm-mw-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;

const buildApp = (): Express => {
  const app = express();
  app.use(cookieParser());
  app.get('/projects/:id/pm-area', requireAuth, requireProjectRole('pm'), (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/projects/:id/member-area', requireAuth, requireProjectRole('member'), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
};

maybe('requireProjectRole middleware', () => {
  const ORIGINAL_ENV = process.env;
  let app: Express;
  let projectId: string;
  let adminId: string;
  let pmUserId: string;
  let memberUserId: string;
  let outsiderId: string;
  const cleanupUserIds: string[] = [];
  const cleanupProjectIds: string[] = [];

  beforeAll(async () => {
    process.env = {
      ...ORIGINAL_ENV,
      JWT_ACCESS_SECRET: SECRET,
      JWT_REFRESH_SECRET: SECRET + 'r',
      ACCESS_TOKEN_TTL: '15m',
      REFRESH_TOKEN_TTL: '7d',
    };
    app = buildApp();

    const admin = await prisma.user.create({
      data: { email: u('admin'), name: 'Admin', passwordHash: await bcrypt.hash('x', 4), role: 'admin' },
    });
    adminId = admin.id;
    cleanupUserIds.push(adminId);
    const pmUser = await prisma.user.create({
      data: { email: u('pm'), name: 'PM', passwordHash: await bcrypt.hash('x', 4), role: 'project_manager' },
    });
    pmUserId = pmUser.id;
    cleanupUserIds.push(pmUserId);
    const memberUser = await prisma.user.create({
      data: { email: u('mem'), name: 'Member', passwordHash: await bcrypt.hash('x', 4), role: 'team_member' },
    });
    memberUserId = memberUser.id;
    cleanupUserIds.push(memberUserId);
    const outsider = await prisma.user.create({
      data: { email: u('out'), name: 'Outsider', passwordHash: await bcrypt.hash('x', 4), role: 'team_member' },
    });
    outsiderId = outsider.id;
    cleanupUserIds.push(outsiderId);

    const p = await prisma.project.create({
      data: { name: `pm-mw-${Date.now()}`, deadline: new Date(Date.now() + 30 * 86400000), createdBy: pmUserId },
    });
    projectId = p.id;
    cleanupProjectIds.push(projectId);

    await prisma.projectMember.create({ data: { projectId, userId: pmUserId, role: 'pm' } });
    await prisma.projectMember.create({ data: { projectId, userId: memberUserId, role: 'member' } });
  });

  afterAll(async () => {
    await prisma.projectMember.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: cleanupProjectIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    await disconnectPrisma();
    process.env = ORIGINAL_ENV;
  });

  const tokFor = (id: string, role: 'admin' | 'project_manager' | 'team_member') =>
    signAccessToken({ sub: id, email: `${role}@x.y`, role });

  it('admin bypasses on any project (pm-area)', async () => {
    const r = await request(app)
      .get(`/projects/${projectId}/pm-area`)
      .set('Cookie', `${ACCESS_COOKIE}=${tokFor(adminId, 'admin')}`);
    expect(r.status).toBe(200);
  });

  it('project pm passes pm-area', async () => {
    const r = await request(app)
      .get(`/projects/${projectId}/pm-area`)
      .set('Cookie', `${ACCESS_COOKIE}=${tokFor(pmUserId, 'project_manager')}`);
    expect(r.status).toBe(200);
  });

  it('project member fails pm-area with 403 FORBIDDEN_PROJECT_ROLE', async () => {
    const r = await request(app)
      .get(`/projects/${projectId}/pm-area`)
      .set('Cookie', `${ACCESS_COOKIE}=${tokFor(memberUserId, 'team_member')}`);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN_PROJECT_ROLE');
  });

  it('project member passes member-area', async () => {
    const r = await request(app)
      .get(`/projects/${projectId}/member-area`)
      .set('Cookie', `${ACCESS_COOKIE}=${tokFor(memberUserId, 'team_member')}`);
    expect(r.status).toBe(200);
  });

  it('outsider (not a member) fails with 403', async () => {
    const r = await request(app)
      .get(`/projects/${projectId}/member-area`)
      .set('Cookie', `${ACCESS_COOKIE}=${tokFor(outsiderId, 'team_member')}`);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN_PROJECT_ROLE');
  });

  it('no token → 401 MISSING_TOKEN', async () => {
    const r = await request(app).get(`/projects/${projectId}/pm-area`);
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('MISSING_TOKEN');
  });
});
