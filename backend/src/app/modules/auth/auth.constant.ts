import { Role } from '@prisma/client';

export const ACCESS_COOKIE = 'sc_at';
export const REFRESH_COOKIE = 'sc_rt';

export const JWT_ALGO = 'HS256' as const;

export const BCRYPT_ROUNDS = 10;

export const ROLES: Role[] = ['admin', 'project_manager', 'team_member'];

export const ACCESS_TOKEN_TYPE = 'access' as const;
export const REFRESH_TOKEN_TYPE = 'refresh' as const;
