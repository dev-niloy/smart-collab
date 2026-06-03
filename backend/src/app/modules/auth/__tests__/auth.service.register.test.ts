import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { authService } from '../auth.service';
import { ApiError } from '../../../errors/ApiError';

const TEST_EMAIL = 't14-register@test.local';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const SECRET = 'x'.repeat(40);

maybe('authService.register', () => {
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

  afterAll(async () => {
    process.env = ORIGINAL_ENV;
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  });

  it('creates user with bcrypt-hashed password and returns token pair', async () => {
    const result = await authService.register({
      email: TEST_EMAIL,
      password: 'plaintext123',
      name: 'T14 User',
    });

    expect(result.user.id).toBeTruthy();
    expect(result.user.email).toBe(TEST_EMAIL);
    expect(result.user.role).toBe('team_member');
    expect(result.tokens.access).toBeTruthy();
    expect(result.tokens.refresh).toBeTruthy();
    expect(result.tokens.access).not.toBe(result.tokens.refresh);

    const dbUser = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.passwordHash).not.toBe('plaintext123');
    expect(await bcrypt.compare('plaintext123', dbUser!.passwordHash)).toBe(true);
  });

  it('persists a session row tied to the refresh token', async () => {
    const result = await authService.register(
      { email: TEST_EMAIL, password: 'plaintext123', name: 'X' },
      { userAgent: 'jest', ip: '127.0.0.1' },
    );
    const sessions = await prisma.session.findMany({ where: { userId: result.user.id } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].userAgent).toBe('jest');
    expect(sessions[0].refreshTokenHash).not.toBe(result.tokens.refresh);
    expect(sessions[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('does not return passwordHash in user payload', async () => {
    const result = await authService.register({
      email: TEST_EMAIL,
      password: 'plaintext123',
      name: 'X',
    });
    expect((result.user as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('rejects duplicate email with 409 ApiError', async () => {
    await authService.register({ email: TEST_EMAIL, password: 'plaintext123', name: 'X' });
    await expect(
      authService.register({ email: TEST_EMAIL, password: 'plaintext123', name: 'X' }),
    ).rejects.toThrow(ApiError);
    await expect(
      authService.register({ email: TEST_EMAIL, password: 'plaintext123', name: 'X' }),
    ).rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_TAKEN' });
  });
});
