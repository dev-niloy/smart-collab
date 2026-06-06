import request from 'supertest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { seedDemoUsers } from '../../../../../prisma/seed';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const SECRET = 'x'.repeat(40);
const DEMO_EMAILS = ['admin@demo.local', 'pm@demo.local', 'member@demo.local'];

const setupEnv = (uploadDir: string) => {
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
    UPLOAD_DIR: uploadDir,
    NODE_ENV: 'test',
  });
};

const PNG_1x1 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63600000000200015c8c2fdd0000000049454e44ae426082',
  'hex',
);

maybe('user routes /api/v1/users/me', () => {
  const ORIGINAL_ENV = { ...process.env };
  const UPLOAD_DIR = path.resolve(process.cwd(), '.test-uploads');
  let app: import('express').Express;

  const loginAs = async (role: 'admin' | 'project_manager' | 'team_member') => {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/demo-login').send({ role });
    expect(res.status).toBe(200);
    return agent;
  };

  beforeAll(async () => {
    setupEnv(UPLOAD_DIR);
    jest.resetModules();
    const mod = await import('../../../../app');
    app = mod.default;
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: '@profile-test.local' } } });
    await seedDemoUsers(prisma);
    await fs.mkdir(path.join(UPLOAD_DIR, 'avatars'), { recursive: true });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: '@profile-test.local' } } });
    await fs.rm(UPLOAD_DIR, { recursive: true, force: true }).catch(() => undefined);
    await disconnectPrisma();
    process.env = ORIGINAL_ENV;
  });

  beforeEach(async () => {
    await prisma.user.updateMany({
      where: { email: { in: DEMO_EMAILS } },
      data: { avatarPath: null },
    });
  });

  describe('GET /users/me', () => {
    it('unauth → 401 MISSING_TOKEN', async () => {
      const res = await request(app).get('/api/v1/users/me');
      expect(res.status).toBe(401);
    });

    it('authed → 200 with PublicUser shape and avatarUrl null when no avatar', async () => {
      const agent = await loginAs('team_member');
      const res = await agent.get('/api/v1/users/me');
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        email: 'member@demo.local',
        role: 'team_member',
        avatarUrl: null,
      });
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('PATCH /users/me', () => {
    it('rejects empty body (validation 422)', async () => {
      const agent = await loginAs('team_member');
      const res = await agent.patch('/api/v1/users/me').send({});
      expect(res.status).toBe(422);
    });

    it('updates name', async () => {
      const agent = await loginAs('team_member');
      const res = await agent.patch('/api/v1/users/me').send({ name: 'Updated Member' });
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Updated Member');
      // restore for downstream tests
      await agent.patch('/api/v1/users/me').send({ name: 'Demo Member' });
    });

    it('updates email when free', async () => {
      const newEmail = `member-renamed-${Date.now()}@profile-test.local`;
      const agent = await loginAs('team_member');
      const res = await agent.patch('/api/v1/users/me').send({ email: newEmail });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(newEmail);
      // restore
      await agent.patch('/api/v1/users/me').send({ email: 'member@demo.local' });
    });

    it('rejects email collision with 422 EMAIL_TAKEN', async () => {
      const agent = await loginAs('team_member');
      const res = await agent
        .patch('/api/v1/users/me')
        .send({ email: 'pm@demo.local' });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });
  });

  describe('PATCH /users/me/password', () => {
    it('rejects bad current password with 422 INVALID_CURRENT_PASSWORD', async () => {
      const agent = await loginAs('team_member');
      const res = await agent.patch('/api/v1/users/me/password').send({
        currentPassword: 'wrong',
        newPassword: 'NewPassword123',
      });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD');
    });

    it('rejects too-short new password (422 validation)', async () => {
      const agent = await loginAs('team_member');
      const res = await agent.patch('/api/v1/users/me/password').send({
        currentPassword: 'demo-member-pw',
        newPassword: 'short',
      });
      expect(res.status).toBe(422);
    });

    it('changes password + keeps caller session + drops other sessions', async () => {
      // Two sessions for the same user — both should exist before, only caller after.
      const callerAgent = await loginAs('team_member');
      const otherAgent = await loginAs('team_member');

      const me = await callerAgent.get('/api/v1/users/me');
      const userId = me.body.user.id;
      const before = await prisma.session.count({ where: { userId } });
      expect(before).toBeGreaterThanOrEqual(2);

      const res = await callerAgent.patch('/api/v1/users/me/password').send({
        currentPassword: 'demo-member-pw',
        newPassword: 'BrandNewPassword123',
      });
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);

      // Caller can still hit /me.
      const callerStill = await callerAgent.get('/api/v1/users/me');
      expect(callerStill.status).toBe(200);

      // Snapshot session count BEFORE poking the other agent — its refresh
      // attempt will trigger auth.service's REFRESH_REUSE burn path and
      // wipe every session row for the user, which is correct production
      // behavior but masks the spare-the-caller assertion.
      const after = await prisma.session.count({ where: { userId } });
      expect(after).toBe(1);

      // Other agent's refresh path should fail because the session row is gone.
      const otherRefresh = await otherAgent.post('/api/v1/auth/refresh');
      expect(otherRefresh.status).toBe(401);

      // Restore: change back so subsequent tests keep working.
      await callerAgent.patch('/api/v1/users/me/password').send({
        currentPassword: 'BrandNewPassword123',
        newPassword: 'demo-member-pw',
      });
    });
  });

  describe('avatar upload + download + delete', () => {
    it('rejects unsupported mime (422)', async () => {
      const agent = await loginAs('team_member');
      const res = await agent
        .post('/api/v1/users/me/avatar')
        .attach('file', Buffer.from('not an image'), { filename: 'a.txt', contentType: 'text/plain' });
      expect(res.status).toBe(422);
    });

    it('uploads a PNG → 200 → avatarUrl present → GET serves bytes', async () => {
      const agent = await loginAs('team_member');
      const up = await agent
        .post('/api/v1/users/me/avatar')
        .attach('file', PNG_1x1, { filename: 'a.png', contentType: 'image/png' });
      expect(up.status).toBe(200);
      expect(up.body.user.avatarUrl).toBe('/api/v1/users/me/avatar');

      const dl = await agent.get('/api/v1/users/me/avatar');
      expect(dl.status).toBe(200);
      expect(dl.headers['content-type']).toMatch(/image\/png/);
      expect(dl.body.length).toBeGreaterThan(0);
    });

    it('DELETE clears avatarUrl back to null + next GET → 404', async () => {
      const agent = await loginAs('team_member');
      await agent
        .post('/api/v1/users/me/avatar')
        .attach('file', PNG_1x1, { filename: 'a.png', contentType: 'image/png' });
      const del = await agent.delete('/api/v1/users/me/avatar');
      expect(del.status).toBe(200);
      expect(del.body.user.avatarUrl).toBeNull();
      const dl = await agent.get('/api/v1/users/me/avatar');
      expect(dl.status).toBe(404);
      expect(dl.body.error.code).toBe('NO_AVATAR');
    });
  });
});
