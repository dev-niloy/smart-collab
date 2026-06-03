import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { authService } from '../auth.service';
import { ApiError } from '../../../errors/ApiError';

const TEST_EMAIL = 't15-refresh@test.local';
const PW = 'plaintext123';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const SECRET = 'x'.repeat(40);

maybe('authService refresh + logout + me', () => {
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

  describe('refresh rotation', () => {
    it('rotates: old session removed, new session created, fresh token pair', async () => {
      const initial = await authService.register({ email: TEST_EMAIL, password: PW, name: 'X' });
      const userId = initial.user.id;

      const before = await prisma.session.findMany({ where: { userId } });
      expect(before).toHaveLength(1);
      const oldSid = before[0].id;

      const rotated = await authService.refresh(initial.tokens.refresh);

      expect(rotated.tokens.access).toBeTruthy();
      expect(rotated.tokens.refresh).not.toBe(initial.tokens.refresh);

      const after = await prisma.session.findMany({ where: { userId } });
      expect(after).toHaveLength(1);
      expect(after[0].id).not.toBe(oldSid);
    });

    it('rejects garbage refresh token with 401', async () => {
      await expect(authService.refresh('not-a-jwt')).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('reuse detection: replayed refresh after rotation kills ALL user sessions', async () => {
      const initial = await authService.register({ email: TEST_EMAIL, password: PW, name: 'X' });
      const userId = initial.user.id;
      const stolen = initial.tokens.refresh;

      // legit rotation
      await authService.refresh(stolen);
      const after1 = await prisma.session.count({ where: { userId } });
      expect(after1).toBe(1);

      // attacker replays stolen token — session jti no longer exists -> reuse
      await expect(authService.refresh(stolen)).rejects.toMatchObject({
        statusCode: 401,
        code: 'REFRESH_REUSE',
      });

      const after2 = await prisma.session.count({ where: { userId } });
      expect(after2).toBe(0);
    });

    it('rejects ApiError on tampered token signature', async () => {
      const initial = await authService.register({ email: TEST_EMAIL, password: PW, name: 'X' });
      const tampered = initial.tokens.refresh.slice(0, -2) + 'XX';
      await expect(authService.refresh(tampered)).rejects.toThrow(ApiError);
    });
  });

  describe('logout', () => {
    it('deletes the session row for the refresh token', async () => {
      const initial = await authService.register({ email: TEST_EMAIL, password: PW, name: 'X' });
      await authService.logout(initial.tokens.refresh);
      const sessions = await prisma.session.findMany({ where: { userId: initial.user.id } });
      expect(sessions).toHaveLength(0);
    });

    it('is idempotent — logout twice does not throw', async () => {
      const initial = await authService.register({ email: TEST_EMAIL, password: PW, name: 'X' });
      await authService.logout(initial.tokens.refresh);
      await expect(authService.logout(initial.tokens.refresh)).resolves.toBeUndefined();
    });

    it('does not throw on garbage refresh token', async () => {
      await expect(authService.logout('not-a-jwt')).resolves.toBeUndefined();
    });
  });

  describe('me', () => {
    it('returns user without passwordHash', async () => {
      const initial = await authService.register({ email: TEST_EMAIL, password: PW, name: 'Me' });
      const me = await authService.me(initial.user.id);
      expect(me.email).toBe(TEST_EMAIL);
      expect(me.name).toBe('Me');
      expect((me as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it('throws 401 when user id unknown', async () => {
      await expect(authService.me('00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });
});
