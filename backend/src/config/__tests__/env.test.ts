/* eslint-disable @typescript-eslint/no-require-imports -- require() needed for jest.resetModules between cases */
describe('config/env loader', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  const validEnv = () => ({
    NODE_ENV: 'development',
    PORT: '4000',
    DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    ACCESS_TOKEN_TTL: '15m',
    REFRESH_TOKEN_TTL: '7d',
    CORS_ORIGINS: 'http://localhost:3000',
    COOKIE_DOMAIN: 'localhost',
    DEMO_ADMIN_PW: 'demo-admin',
    DEMO_PM_PW: 'demo-pm',
    DEMO_MEMBER_PW: 'demo-member',
  });

  it('loads a complete valid env', () => {
    process.env = { ...process.env, ...validEnv() };
    const { loadEnv } = require('../env');
    const env = loadEnv();
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000']);
  });

  it('parses CORS_ORIGINS comma-separated', () => {
    process.env = {
      ...process.env,
      ...validEnv(),
      CORS_ORIGINS: 'http://a.test, http://b.test ,http://c.test',
    };
    const { loadEnv } = require('../env');
    const env = loadEnv();
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test', 'http://c.test']);
  });

  it('throws when a required secret is missing', () => {
    const e = validEnv() as Record<string, string>;
    delete e.JWT_ACCESS_SECRET;
    process.env = { ...process.env, ...e };
    delete process.env.JWT_ACCESS_SECRET;
    const { loadEnv } = require('../env');
    expect(() => loadEnv()).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('throws when JWT secret is too short', () => {
    process.env = { ...process.env, ...validEnv(), JWT_ACCESS_SECRET: 'short' };
    const { loadEnv } = require('../env');
    expect(() => loadEnv()).toThrow();
  });

  it('throws when PORT is not numeric', () => {
    process.env = { ...process.env, ...validEnv(), PORT: 'abc' };
    const { loadEnv } = require('../env');
    expect(() => loadEnv()).toThrow();
  });

  it('rejects invalid NODE_ENV', () => {
    process.env = { ...process.env, ...validEnv(), NODE_ENV: 'banana' };
    const { loadEnv } = require('../env');
    expect(() => loadEnv()).toThrow();
  });
});
