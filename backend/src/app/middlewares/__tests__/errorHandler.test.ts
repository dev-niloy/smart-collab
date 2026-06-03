import express, { type Express } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { ApiError } from '../../errors/ApiError';
import { errorHandler, notFoundHandler } from '../errorHandler';

const buildTestApp = (): Express => {
  const app = express();
  app.use(express.json());

  app.get('/throw-api', (_req, _res, next) => {
    next(ApiError.conflict('Already exists', 'DUPLICATE', { field: 'email' }));
  });

  app.get('/throw-zod', (_req, _res, next) => {
    const schema = z.object({ name: z.string().min(3) });
    const parsed = schema.safeParse({ name: 'ab' });
    if (!parsed.success) return next(parsed.error);
    return _res.json(parsed.data);
  });

  app.get('/throw-generic', (_req, _res, next) => {
    next(new Error('boom'));
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

describe('errorHandler', () => {
  const app = buildTestApp();

  it('serializes ApiError with code, status, details', async () => {
    const res = await request(app).get('/throw-api');
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: 'DUPLICATE', message: 'Already exists', details: { field: 'email' } },
    });
  });

  it('converts ZodError to 422 with VALIDATION_ERROR + issues', async () => {
    const res = await request(app).get('/throw-zod');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details[0]).toHaveProperty('path');
    expect(res.body.error.details[0]).toHaveProperty('message');
  });

  it('falls back to 500 INTERNAL on generic Error', async () => {
    const res = await request(app).get('/throw-generic');
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL');
    expect(res.body.error.message).toBe('boom');
  });

  it('returns 404 NOT_FOUND for unknown route', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  it('ApiError statics build correct status codes', () => {
    expect(ApiError.badRequest('x').statusCode).toBe(400);
    expect(ApiError.unauthorized().statusCode).toBe(401);
    expect(ApiError.forbidden().statusCode).toBe(403);
    expect(ApiError.notFound().statusCode).toBe(404);
    expect(ApiError.conflict('x').statusCode).toBe(409);
    expect(ApiError.unprocessable('x').statusCode).toBe(422);
    expect(ApiError.internal().statusCode).toBe(500);
  });
});
