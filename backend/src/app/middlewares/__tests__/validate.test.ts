import express, { type Express, type Request, type Response } from 'express';
import request from 'supertest';
import { z } from 'zod';

import { validate } from '../validate';
import { errorHandler } from '../errorHandler';

const buildApp = (): Express => {
  const app = express();
  app.use(express.json());

  const bodySchema = z.object({ name: z.string().min(2), age: z.number().int().positive() });
  const querySchema = z.object({ page: z.coerce.number().int().positive().default(1) });
  const paramsSchema = z.object({ id: z.string().uuid() });

  app.post('/body', validate({ body: bodySchema }), (req: Request, res: Response) => {
    res.json(req.body);
  });

  app.get('/query', validate({ query: querySchema }), (req: Request, res: Response) => {
    res.json(req.query);
  });

  app.get('/params/:id', validate({ params: paramsSchema }), (req: Request, res: Response) => {
    res.json(req.params);
  });

  app.use(errorHandler);
  return app;
};

describe('validate middleware', () => {
  const app = buildApp();

  it('passes valid body through and replaces req.body with parsed', async () => {
    const res = await request(app).post('/body').send({ name: 'Niloy', age: 30 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: 'Niloy', age: 30 });
  });

  it('rejects invalid body with 422 VALIDATION_ERROR', async () => {
    const res = await request(app).post('/body').send({ name: 'x', age: -1 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects missing required field with 422', async () => {
    const res = await request(app).post('/body').send({ name: 'Niloy' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('coerces and defaults query string', async () => {
    const res = await request(app).get('/query');
    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
  });

  it('rejects invalid path param uuid', async () => {
    const res = await request(app).get('/params/not-a-uuid');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts valid uuid path param', async () => {
    const res = await request(app).get('/params/123e4567-e89b-12d3-a456-426614174000');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('123e4567-e89b-12d3-a456-426614174000');
  });
});
