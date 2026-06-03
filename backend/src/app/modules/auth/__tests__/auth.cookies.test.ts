import express, { type Express } from 'express';
import request from 'supertest';
import { setAuthCookies, clearAuthCookies } from '../auth.cookies';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../auth.constant';

const SECRET = 'x'.repeat(40);

const buildApp = (): Express => {
  const app = express();
  app.post('/set', (_req, res) => {
    setAuthCookies(res, { access: 'AT', refresh: 'RT' });
    res.json({ ok: true });
  });
  app.post('/clear', (_req, res) => {
    clearAuthCookies(res);
    res.json({ ok: true });
  });
  return app;
};

describe('auth cookies', () => {
  const ORIGINAL_ENV = process.env;

  beforeAll(() => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'test',
      ACCESS_TOKEN_TTL: '15m',
      REFRESH_TOKEN_TTL: '7d',
      JWT_ACCESS_SECRET: SECRET,
      JWT_REFRESH_SECRET: SECRET,
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('sets both cookies httpOnly with correct names', async () => {
    const res = await request(buildApp()).post('/set');
    const cookies = (res.headers['set-cookie'] as unknown as string[]) || [];
    const all = cookies.join('\n');
    expect(all).toContain(`${ACCESS_COOKIE}=AT`);
    expect(all).toContain(`${REFRESH_COOKIE}=RT`);
    expect(all.toLowerCase()).toContain('httponly');
  });

  it('uses sameSite=lax outside production', async () => {
    process.env.NODE_ENV = 'development';
    const res = await request(buildApp()).post('/set');
    const cookies = (res.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(cookies.toLowerCase()).toContain('samesite=lax');
    expect(cookies.toLowerCase()).not.toContain('secure');
    process.env.NODE_ENV = 'test';
  });

  it('sets secure + sameSite=none in production', async () => {
    process.env.NODE_ENV = 'production';
    const res = await request(buildApp()).post('/set');
    const cookies = (res.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(cookies.toLowerCase()).toContain('samesite=none');
    expect(cookies.toLowerCase()).toContain('secure');
    process.env.NODE_ENV = 'test';
  });

  it('clearAuthCookies emits expired Set-Cookie for both', async () => {
    const res = await request(buildApp()).post('/clear');
    const cookies = (res.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(cookies).toContain(`${ACCESS_COOKIE}=`);
    expect(cookies).toContain(`${REFRESH_COOKIE}=`);
    expect(cookies.toLowerCase()).toContain('expires=thu, 01 jan 1970');
  });
});
