import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { ApiError } from '../errors/ApiError';

export const requireRole = (...allowed: Role[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED'));
    }
    if (!allowed.includes(req.user.role)) {
      return next(ApiError.forbidden('Insufficient role', 'FORBIDDEN_ROLE'));
    }
    return next();
  };
};
