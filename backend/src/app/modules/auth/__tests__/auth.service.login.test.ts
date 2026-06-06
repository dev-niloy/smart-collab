import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { authService } from '../auth.service';
import { ApiError } from '../../../errors/ApiError';

const TEST_EMAIL = 't14-login@test.local';
const PW = 'plaintext123';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const SECRET = 'x'.repeat(40);

maybe('authService.login', () => {
  const ORIGINAL_ENV = process.env;

  beforeAll(async () => {
    process.env = {
      ...ORIGINAL_ENV,
      JWT_ACCESS_SECRET: SECRET,
      JWT_REFRESH_SECRET: SECRET + 'r',
      ACCESS_TOKEN_TTL: '15m',
      REFRESH_TOKEN_TTL: '7d',
    };
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await authService.register({ email: TEST_EMAIL, password: PW, name: 'Login User' });
  });

  afterAll(async () => {
    process.env = ORIGINAL_ENV;
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await disconnectPrisma();
  });

  it('issues fresh token pair + session on valid creds', async () => {
    const before = await prisma.session.count({ where: { user: { email: TEST_EMAIL } } });
    const r = await authService.login({ email: TEST_EMAIL, password: PW }, { userAgent: 'jest-login' });
    expect(r.tokens.access).toBeTruthy();
    expect(r.tokens.refresh).toBeTruthy();
    const after = await prisma.session.count({ where: { user: { email: TEST_EMAIL } } });
    expect(after).toBe(before + 1);
  });

  it('rejects wrong password with 401 INVALID_CREDENTIALS', async () => {
    await expect(
      authService.login({ email: TEST_EMAIL, password: 'WRONG-pass' }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('rejects unknown email with same 401 INVALID_CREDENTIALS (no enumeration)', async () => {
    await expect(
      authService.login({ email: 'nobody@nowhere.test', password: PW }),
    ).rejects.toMatchObject({ statusCode: 401, code: 'INVALID_CREDENTIALS' });
  });

  it('throws ApiError instances (not raw Error)', async () => {
    await expect(
      authService.login({ email: TEST_EMAIL, password: 'WRONG' }),
    ).rejects.toThrow(ApiError);
  });
});
