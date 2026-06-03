import bcrypt from 'bcrypt';
import type { Role, User } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import { BCRYPT_ROUNDS } from './auth.constant';
import type { SignupInput, LoginInput } from './auth.validation';
import {
  signAccessToken,
  signRefreshToken,
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
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
    },
  });
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

export const authService = {
  register,
  login,
  demoLogin,
  stripPassword,
  issueTokensAndSession,
};
