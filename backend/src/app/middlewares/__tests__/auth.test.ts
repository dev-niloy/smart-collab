import express, { type Express, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { requireAuth } from '../auth';
import { errorHandler } from '../errorHandler';
import { signAccessToken } from '../../modules/auth/auth.tokens';
import { ACCESS_COOKIE } from '../../modules/auth/auth.constant';

const SECRET = 'x'.repeat(40);

const buildApp = (): Express => {
  const app = express();
  app.use(cookieParser());

  app.get('/secret', requireAuth, (req: Request, res: Response) => {
    res.json({ uid: req.user?.id, role: req.user?.role });
  });

  app.use(errorHandler);
  return app;
};

describe('requireAuth middleware', () => {
  const ORIGINAL_ENV = process.env;

  beforeAll(() => {
    process.env = {
      ...ORIGINAL_ENV,
      JWT_ACCESS_SECRET: SECRET,
      JWT_REFRESH_SECRET: SECRET + 'r',
      ACCESS_TOKEN_TTL: '15m',
      REFRESH_TOKEN_TTL: '7d',
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  const app = buildApp();

  it('401 MISSING_TOKEN when no cookie', async () => {
    const res = await request(app).get('/secret');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('MISSING_TOKEN');
  });

  it('401 INVALID_TOKEN on tampered jwt', async () => {
    const res = await request(app).get('/secret').set('Cookie', `${ACCESS_COOKIE}=garbage`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('hydrates req.user and 200 on valid access cookie', async () => {
    const token = signAccessToken({
      sub: 'user-uuid',
      email: 'x@y.z',
      role: 'admin',
    });
    const res = await request(app).get('/secret').set('Cookie', `${ACCESS_COOKIE}=${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ uid: 'user-uuid', role: 'admin' });
  });

  it('401 INVALID_TOKEN on a refresh-type token used as access', async () => {
    process.env.JWT_REFRESH_SECRET = SECRET;
    const { signRefreshToken } = await import('../../modules/auth/auth.tokens');
    const { token } = signRefreshToken('user-uuid');
    const res = await request(app).get('/secret').set('Cookie', `${ACCESS_COOKIE}=${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});
