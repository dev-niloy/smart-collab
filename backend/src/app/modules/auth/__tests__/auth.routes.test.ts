import request from 'supertest';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { seedDemoUsers } from '../../../../../prisma/seed';

const TEST_EMAIL = 't17-routes@test.local';
const PW = 'plaintext123';

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
    // Intentionally NOT setting COOKIE_DOMAIN: supertest agent runs against
    // an in-memory address, and an explicit domain attribute breaks cookie persistence.
    COOKIE_DOMAIN: '',
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: 'test',
  });
};

const DEMO_EMAILS = ['admin@demo.local', 'pm@demo.local', 'member@demo.local'];

const extractCookie = (raw: string[] | undefined, name: string): string | undefined => {
  if (!raw) return undefined;
  const line = raw.find((c) => c.startsWith(`${name}=`));
  if (!line) return undefined;
  return line.split(';')[0];
};

maybe('auth routes /api/v1/auth', () => {
  const ORIGINAL_ENV = { ...process.env };

  let app: import('express').Express;

  beforeAll(async () => {
    setupEnv();
    jest.resetModules();
    const mod = await import('../../../../app');
    app = mod.default;
    await prisma.user.deleteMany({ where: { email: { in: [...DEMO_EMAILS, TEST_EMAIL] } } });
    await seedDemoUsers(prisma);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [...DEMO_EMAILS, TEST_EMAIL] } } });
    await disconnectPrisma();
    process.env = ORIGINAL_ENV;
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  });

  it('signup → 201 with user, sets both cookies', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: TEST_EMAIL, password: PW, name: 'Route' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(extractCookie(cookies, 'sc_at')).toBeTruthy();
    expect(extractCookie(cookies, 'sc_rt')).toBeTruthy();
  });

  it('signup with bad payload → 422 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/api/v1/auth/signup').send({ email: 'bad', password: 'x', name: '' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('signup duplicate → 409 EMAIL_TAKEN', async () => {
    await request(app).post('/api/v1/auth/signup').send({ email: TEST_EMAIL, password: PW, name: 'X' });
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: TEST_EMAIL, password: PW, name: 'X' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('full flow: signup → me → logout → me 401', async () => {
    const agent = request.agent(app);

    await agent.post('/api/v1/auth/signup').send({ email: TEST_EMAIL, password: PW, name: 'Flow' }).expect(201);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(TEST_EMAIL);

    const logout = await agent.post('/api/v1/auth/logout');
    expect(logout.status).toBe(204);

    const me2 = await agent.get('/api/v1/auth/me');
    expect(me2.status).toBe(401);
  });

  it('login bad password → 401 INVALID_CREDENTIALS', async () => {
    await request(app).post('/api/v1/auth/signup').send({ email: TEST_EMAIL, password: PW, name: 'X' });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_EMAIL, password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('demo-login admin → 200 + cookies; me returns admin role', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/v1/auth/demo-login').send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('admin');
    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('admin');
  });

  it('refresh rotates: new access cookie and me still works', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/signup').send({ email: TEST_EMAIL, password: PW, name: 'R' }).expect(201);
    const ref = await agent.post('/api/v1/auth/refresh');
    expect(ref.status).toBe(200);
    const cookies = ref.headers['set-cookie'] as unknown as string[];
    expect(extractCookie(cookies, 'sc_at')).toBeTruthy();
    expect(extractCookie(cookies, 'sc_rt')).toBeTruthy();
    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
  });

  it('refresh without cookie → 401 MISSING_REFRESH', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_REFRESH');
  });
});
