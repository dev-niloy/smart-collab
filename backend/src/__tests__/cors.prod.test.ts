describe('CORS prod hardening', () => {
  const ORIGINAL_ENV = process.env;

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    jest.resetModules();
  });

  const importAppWithProdOrigins = async (origins: string) => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: 'production', CORS_ORIGINS: origins };
    jest.resetModules();
    const mod = await import('../app');
    return mod.default;
  };

  it('strips wildcard "*" in production so credentialed CORS cannot be opened to the world', async () => {
    const request = (await import('supertest')).default;
    const app = await importAppWithProdOrigins('*');
    const res = await request(app).get('/healthz').set('Origin', 'http://evil.test');
    expect(res.status).toBe(200);
    // wildcard was filtered out → no origin allowed → no ACAO header echoed
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('parses a comma-separated allowlist correctly and echoes each listed origin in production', async () => {
    const request = (await import('supertest')).default;
    const app = await importAppWithProdOrigins(
      'https://app.vercel.app, https://staging.vercel.app',
    );

    const allowed1 = await request(app).get('/healthz').set('Origin', 'https://app.vercel.app');
    expect(allowed1.headers['access-control-allow-origin']).toBe('https://app.vercel.app');

    const allowed2 = await request(app).get('/healthz').set('Origin', 'https://staging.vercel.app');
    expect(allowed2.headers['access-control-allow-origin']).toBe('https://staging.vercel.app');

    const denied = await request(app).get('/healthz').set('Origin', 'https://attacker.test');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
