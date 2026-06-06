import { z } from 'zod';

const csv = (raw: string) =>
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const ttlPattern = /^\d+(ms|s|m|h|d)$/;

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .default('4000')
    .transform((v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`PORT must be a positive number, got: ${v}`);
      }
      return n;
    }),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  JWT_ACCESS_SECRET: z
    .string({ required_error: 'JWT_ACCESS_SECRET is required' })
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string({ required_error: 'JWT_REFRESH_SECRET is required' })
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.string().regex(ttlPattern, 'ACCESS_TOKEN_TTL must match e.g. 15m, 1h, 7d'),
  REFRESH_TOKEN_TTL: z.string().regex(ttlPattern, 'REFRESH_TOKEN_TTL must match e.g. 15m, 1h, 7d'),
  // Defaults to empty so the service can boot before the frontend origin is
  // known. Empty list = no origins allowed; same-origin endpoints like
  // /healthz still respond. Set to the real Vercel URL once it exists.
  CORS_ORIGINS: z.string().default('').transform(csv),
  // Default empty so cross-site cookie scopes to the host. A whitespace-only
  // value is treated the same; `auth.cookies.ts` trims before passing to express.
  COOKIE_DOMAIN: z.string().default(''),
  DEMO_ADMIN_PW: z.string().min(1),
  DEMO_PM_PW: z.string().min(1),
  DEMO_MEMBER_PW: z.string().min(1),
  // Defaults to enabled so the assessment Demo Login button works out of the box.
  // Set to "false" on production deploys after assessment to disable demo accounts.
  ENABLE_DEMO_LOGIN: z
    .string()
    .default('true')
    .transform((v) => v.toLowerCase() !== 'false'),
});

export type Env = z.infer<typeof envSchema>;

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): Env => {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
};

let cached: Env | undefined;

export const env = (): Env => {
  if (!cached) cached = loadEnv();
  return cached;
};

export const resetEnvCache = (): void => {
  cached = undefined;
};
