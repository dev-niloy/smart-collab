import request from 'supertest';
import app from '../app';

describe('GET /healthz', () => {
  it('returns 200 with {ok:true}', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('sets security headers via helmet', async () => {
    const res = await request(app).get('/healthz');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('returns 404 with json error for unknown route', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});
