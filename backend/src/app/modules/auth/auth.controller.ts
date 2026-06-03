import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { authService } from './auth.service';
import { setAuthCookies, clearAuthCookies } from './auth.cookies';
import { REFRESH_COOKIE } from './auth.constant';
import type { Role } from '@prisma/client';

const ctxFrom = (req: Request) => ({
  userAgent: req.get('user-agent') ?? undefined,
  ip: req.ip,
});

export const authController = {
  signup: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.register(req.body, ctxFrom(req));
      setAuthCookies(res, result.tokens);
      res.status(201).json({ user: result.user });
    } catch (err) {
      next(err);
    }
  },

  login: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(req.body, ctxFrom(req));
      setAuthCookies(res, result.tokens);
      res.status(200).json({ user: result.user });
    } catch (err) {
      next(err);
    }
  },

  demoLogin: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.demoLogin(req.body.role as Role, ctxFrom(req));
      setAuthCookies(res, result.tokens);
      res.status(200).json({ user: result.user });
    } catch (err) {
      next(err);
    }
  },

  refresh: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.[REFRESH_COOKIE];
      if (!token) throw ApiError.unauthorized('Missing refresh token', 'MISSING_REFRESH');
      const result = await authService.refresh(token, ctxFrom(req));
      setAuthCookies(res, result.tokens);
      res.status(200).json({ user: result.user });
    } catch (err) {
      next(err);
    }
  },

  logout: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.cookies?.[REFRESH_COOKIE];
      if (token) await authService.logout(token);
      clearAuthCookies(res);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  me: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const user = await authService.me(userId);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },
};
