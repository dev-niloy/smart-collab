import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { JWT_ALGO, ACCESS_TOKEN_TYPE, REFRESH_TOKEN_TYPE } from './auth.constant';
import type { Role } from '@prisma/client';

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: Role;
  type: typeof ACCESS_TOKEN_TYPE;
};

export type RefreshTokenPayload = {
  sub: string;
  jti: string;
  type: typeof REFRESH_TOKEN_TYPE;
};

const requireSecret = (key: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string => {
  const v = process.env[key];
  if (!v) throw new Error(`${key} not set`);
  return v;
};

const requireTtl = (key: 'ACCESS_TOKEN_TTL' | 'REFRESH_TOKEN_TTL'): string => {
  const v = process.env[key];
  if (!v) throw new Error(`${key} not set`);
  return v;
};

export const signAccessToken = (payload: Omit<AccessTokenPayload, 'type'>): string => {
  const secret = requireSecret('JWT_ACCESS_SECRET');
  const opts: SignOptions = {
    algorithm: JWT_ALGO,
    expiresIn: requireTtl('ACCESS_TOKEN_TTL') as SignOptions['expiresIn'],
  };
  return jwt.sign({ ...payload, type: ACCESS_TOKEN_TYPE }, secret, opts);
};

export const signRefreshToken = (sub: string): { token: string; jti: string } => {
  const secret = requireSecret('JWT_REFRESH_SECRET');
  const jti = crypto.randomUUID();
  const opts: SignOptions = {
    algorithm: JWT_ALGO,
    expiresIn: requireTtl('REFRESH_TOKEN_TTL') as SignOptions['expiresIn'],
  };
  const token = jwt.sign({ sub, jti, type: REFRESH_TOKEN_TYPE }, secret, opts);
  return { token, jti };
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const secret = requireSecret('JWT_ACCESS_SECRET');
  const decoded = jwt.verify(token, secret, { algorithms: [JWT_ALGO] }) as AccessTokenPayload;
  if (decoded.type !== ACCESS_TOKEN_TYPE) throw new Error('Wrong token type');
  return decoded;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const secret = requireSecret('JWT_REFRESH_SECRET');
  const decoded = jwt.verify(token, secret, { algorithms: [JWT_ALGO] }) as RefreshTokenPayload;
  if (decoded.type !== REFRESH_TOKEN_TYPE) throw new Error('Wrong token type');
  return decoded;
};

// SHA-256 for refresh-token storage. High-entropy input — bcrypt overkill here;
// bcrypt is for slow-hashing low-entropy passwords. We just need to make a stolen
// DB row not directly usable as a refresh token.
export const hashRefreshToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

// Parse a TTL string like "15m" / "7d" to milliseconds.
const TTL_RE = /^(\d+)(ms|s|m|h|d)$/;
export const ttlToMs = (ttl: string): number => {
  const m = TTL_RE.exec(ttl);
  if (!m) throw new Error(`Invalid TTL: ${ttl}`);
  const n = Number(m[1]);
  switch (m[2]) {
    case 'ms':
      return n;
    case 's':
      return n * 1000;
    case 'm':
      return n * 60_000;
    case 'h':
      return n * 3_600_000;
    case 'd':
      return n * 86_400_000;
    default:
      throw new Error(`Unreachable TTL unit: ${m[2]}`);
  }
};
