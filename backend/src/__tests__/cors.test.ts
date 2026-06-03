describe('CORS allowlist', () => {
  const ORIGINAL_ENV = process.env;

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetModules();
  });

  const importAppWithOrigins = async (origins: string) => {
    process.env = { ...ORIGINAL_ENV, CORS_ORIGINS: origins };
    jest.resetModules();
    const mod = await import('../app');
    return mod.default;
  };

  it('echoes allowed origin back', async () => {
    const request = (await import('supertest')).default;
    const app = await importAppWithOrigins('http://allowed.test');
    const res = await request(app).get('/healthz').set('Origin', 'http://allowed.test');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://allowed.test');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does NOT echo a disallowed origin', async () => {
    const request = (await import('supertest')).default;
    const app = await importAppWithOrigins('http://allowed.test');
    const res = await request(app).get('/healthz').set('Origin', 'http://evil.test');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects all origins when CORS_ORIGINS is empty', async () => {
    const request = (await import('supertest')).default;
    const app = await importAppWithOrigins('');
    const res = await request(app).get('/healthz').set('Origin', 'http://any.test');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
