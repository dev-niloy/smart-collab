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

maybe('user routes /api/v1/users', () => {
  const ORIGINAL_ENV = { ...process.env };
  let app: import('express').Express;

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
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await seedDemoUsers(prisma);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
    await disconnectPrisma();
    process.env = ORIGINAL_ENV;
  });

  it('unauth -> 401 MISSING_TOKEN', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  it('authed admin -> 200 with 3 demo users', async () => {
    const agent = await loginAs('admin');
    const res = await agent.get('/api/v1/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    const emails = res.body.data.map((u: { email: string }) => u.email);
    expect(emails).toEqual(expect.arrayContaining(DEMO_EMAILS));
  });

  it('returns minimal shape (no passwordHash, no timestamps)', async () => {
    const agent = await loginAs('admin');
    const res = await agent.get('/api/v1/users');
    const u = res.body.data[0];
    expect(u).toHaveProperty('id');
    expect(u).toHaveProperty('email');
    expect(u).toHaveProperty('name');
    expect(u).toHaveProperty('role');
    expect(u).not.toHaveProperty('passwordHash');
    expect(u).not.toHaveProperty('createdAt');
    expect(u).not.toHaveProperty('updatedAt');
  });

  it('member can also list users (assignee picker UX)', async () => {
    const agent = await loginAs('team_member');
    const res = await agent.get('/api/v1/users');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('PM can also list users', async () => {
    const agent = await loginAs('project_manager');
    const res = await agent.get('/api/v1/users');
    expect(res.status).toBe(200);
  });
});
