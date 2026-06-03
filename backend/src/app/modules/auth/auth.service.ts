import bcrypt from 'bcrypt';
import type { Role, User } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import { BCRYPT_ROUNDS } from './auth.constant';
import type { SignupInput, LoginInput } from './auth.validation';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashRefreshToken,
  ttlToMs,
} from './auth.tokens';

export type PublicUser = Omit<User, 'passwordHash'>;

export type AuthContext = {
  userAgent?: string;
  ip?: string;
};

export type AuthResult = {
  user: PublicUser;
  tokens: { access: string; refresh: string };
  sessionId: string;
};

const stripPassword = (u: User): PublicUser => {
  const rest = { ...u } as Partial<User>;
  delete rest.passwordHash;
  return rest as PublicUser;
};

const issueTokensAndSession = async (
  user: User,
  ctx: AuthContext = {},
): Promise<AuthResult> => {
  const access = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const { token: refresh, jti } = signRefreshToken(user.id);

  const refreshTtl = process.env.REFRESH_TOKEN_TTL ?? '7d';
  const expiresAt = new Date(Date.now() + ttlToMs(refreshTtl));

  const session = await prisma.session.create({
    data: {
      id: jti,
      userId: user.id,
      refreshTokenHash: hashRefreshToken(refresh),
      userAgent: ctx.userAgent ?? null,
      ip: ctx.ip ?? null,
      expiresAt,
    },
  });

  return {
    user: stripPassword(user),
    tokens: { access, refresh },
    sessionId: session.id,
  };
};

const register = async (input: SignupInput, ctx: AuthContext = {}): Promise<AuthResult> => {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw ApiError.conflict('Email already registered', 'EMAIL_TAKEN');
  }
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  let user: User;
  try {
    user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
      },
    });
  } catch (err) {
    // findUnique + create is non-atomic — a concurrent signup with the same email
    // can slip past the existence check and hit the unique constraint here.
    // Re-map to the same 409 the slow path returns.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw ApiError.conflict('Email already registered', 'EMAIL_TAKEN');
    }
    throw err;
  }
  return issueTokensAndSession(user, ctx);
};

const login = async (input: LoginInput, ctx: AuthContext = {}): Promise<AuthResult> => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    // Constant-ish-time path: still hash a string so timing leak is minimized.
    await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    throw ApiError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');
  }
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) {
    throw ApiError.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS');
  }
  return issueTokensAndSession(user, ctx);
};

const demoLogin = async (role: Role, ctx: AuthContext = {}): Promise<AuthResult> => {
  const emailByRole: Record<Role, string> = {
    admin: 'admin@demo.local',
    project_manager: 'pm@demo.local',
    team_member: 'member@demo.local',
  };
  const user = await prisma.user.findUnique({ where: { email: emailByRole[role] } });
  if (!user) {
    throw ApiError.notFound(`Demo ${role} account not seeded`, 'DEMO_NOT_SEEDED');
  }
  return issueTokensAndSession(user, ctx);
};

const refresh = async (refreshToken: string, ctx: AuthContext = {}): Promise<AuthResult> => {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token', 'INVALID_REFRESH');
  }

  const expectedHash = hashRefreshToken(refreshToken);
  const session = await prisma.session.findUnique({ where: { id: payload.jti } });

  if (!session) {
    // Token verifies but jti not in DB -> reuse. Burn all user sessions.
    await prisma.session.deleteMany({ where: { userId: payload.sub } });
    throw ApiError.unauthorized('Refresh token reuse detected', 'REFRESH_REUSE');
  }

  if (session.refreshTokenHash !== expectedHash || session.userId !== payload.sub) {
    await prisma.session.deleteMany({ where: { userId: payload.sub } });
    throw ApiError.unauthorized('Refresh token reuse detected', 'REFRESH_REUSE');
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } });
    throw ApiError.unauthorized('Refresh token expired', 'REFRESH_EXPIRED');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) {
    await prisma.session.delete({ where: { id: session.id } });
    throw ApiError.unauthorized('User not found', 'INVALID_REFRESH');
  }

  await prisma.session.delete({ where: { id: session.id } });
  return issueTokensAndSession(user, ctx);
};

const logout = async (refreshToken: string): Promise<void> => {
  try {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.session.deleteMany({ where: { id: payload.jti } });
  } catch {
    // swallow — logout is idempotent and never reveals validity
  }
};

const me = async (userId: string): Promise<PublicUser> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.unauthorized('User not found', 'USER_NOT_FOUND');
  return stripPassword(user);
};

export const authService = {
  register,
  login,
  demoLogin,
  refresh,
  logout,
  me,
  stripPassword,
  issueTokensAndSession,
};
