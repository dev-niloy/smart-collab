import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { requireAuth } from '../auth';
import { requireRole } from '../rbac';
import { errorHandler } from '../errorHandler';
import { signAccessToken } from '../../modules/auth/auth.tokens';
import { ACCESS_COOKIE } from '../../modules/auth/auth.constant';

const SECRET = 'x'.repeat(40);

const buildApp = (): Express => {
  const app = express();
  app.use(cookieParser());

  app.get('/admin-only', requireAuth, requireRole('admin'), (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/pm-or-admin', requireAuth, requireRole('admin', 'project_manager'), (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/anyone-authed', requireAuth, (_req, res) => {
    res.json({ ok: true });
  });

  app.use(errorHandler);
  return app;
};

const tokenFor = (role: 'admin' | 'project_manager' | 'team_member') =>
  signAccessToken({ sub: 'uid-' + role, email: `${role}@x.y`, role });

describe('requireRole middleware', () => {
  const ORIGINAL_ENV = process.env;
  let app: Express;

  beforeAll(() => {
    process.env = {
      ...ORIGINAL_ENV,
      JWT_ACCESS_SECRET: SECRET,
      JWT_REFRESH_SECRET: SECRET + 'r',
      ACCESS_TOKEN_TTL: '15m',
      REFRESH_TOKEN_TTL: '7d',
    };
    app = buildApp();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('admin token passes admin-only', async () => {
    const r = await request(app).get('/admin-only').set('Cookie', `${ACCESS_COOKIE}=${tokenFor('admin')}`);
    expect(r.status).toBe(200);
  });

  it('pm token blocked from admin-only with 403 FORBIDDEN_ROLE', async () => {
    const r = await request(app)
      .get('/admin-only')
      .set('Cookie', `${ACCESS_COOKIE}=${tokenFor('project_manager')}`);
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('FORBIDDEN_ROLE');
  });

  it('member blocked from admin-only', async () => {
    const r = await request(app).get('/admin-only').set('Cookie', `${ACCESS_COOKIE}=${tokenFor('team_member')}`);
    expect(r.status).toBe(403);
  });

  it('admin and pm pass pm-or-admin; member blocked', async () => {
    expect(
      (await request(app).get('/pm-or-admin').set('Cookie', `${ACCESS_COOKIE}=${tokenFor('admin')}`)).status,
    ).toBe(200);
    expect(
      (
        await request(app)
          .get('/pm-or-admin')
          .set('Cookie', `${ACCESS_COOKIE}=${tokenFor('project_manager')}`)
      ).status,
    ).toBe(200);
    expect(
      (await request(app).get('/pm-or-admin').set('Cookie', `${ACCESS_COOKIE}=${tokenFor('team_member')}`)).status,
    ).toBe(403);
  });

  it('no auth → requireAuth catches first with 401 MISSING_TOKEN', async () => {
    const r = await request(app).get('/admin-only');
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('MISSING_TOKEN');
  });

  it('all 3 roles pass anyone-authed', async () => {
    for (const role of ['admin', 'project_manager', 'team_member'] as const) {
      const r = await request(app).get('/anyone-authed').set('Cookie', `${ACCESS_COOKIE}=${tokenFor(role)}`);
      expect(r.status).toBe(200);
    }
  });
});
