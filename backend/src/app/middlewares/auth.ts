import type { RequestHandler } from 'express';
import { ApiError } from '../errors/ApiError';
import { ACCESS_COOKIE } from '../modules/auth/auth.constant';
import { verifyAccessToken } from '../modules/auth/auth.tokens';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (!token) {
    return next(ApiError.unauthorized('Missing access token', 'MISSING_TOKEN'));
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    return next();
  } catch {
    return next(ApiError.unauthorized('Invalid or expired token', 'INVALID_TOKEN'));
  }
};
