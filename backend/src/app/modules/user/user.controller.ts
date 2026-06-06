import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { REFRESH_COOKIE } from '../auth/auth.constant';
import { verifyRefreshToken } from '../auth/auth.tokens';
import { userService } from './user.service';

const requireActorId = (req: Request): string => {
  const id = req.user?.id;
  if (!id) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
  return id;
};

/**
 * Pulls the JWT id (`jti`) of the caller's CURRENT session out of the
 * refresh cookie so we can spare it during the
 * "drop every other session on password change" flow. Returns null when
 * no refresh cookie or it's invalid — caller treats null as "no
 * session to spare".
 */
const currentSessionIdFromCookie = (req: Request): string | null => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token || typeof token !== 'string') return null;
  try {
    return verifyRefreshToken(token).jti;
  } catch {
    return null;
  }
};

export const userController = {
  list: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await userService.list();
      res.status(200).json({ data: users });
    } catch (err) {
      next(err);
    }
  },

  me: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.getMe(requireActorId(req));
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },

  updateMe: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.updateMe(requireActorId(req), req.body);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },

  changePassword: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await userService.changePassword(
        requireActorId(req),
        currentSessionIdFromCookie(req),
        req.body,
      );
      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  },

  uploadAvatar: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw ApiError.unprocessable('No file uploaded', 'NO_FILE');
      }
      const user = await userService.uploadAvatar(requireActorId(req), {
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
      });
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },

  removeAvatar: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.removeAvatar(requireActorId(req));
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  },

  getAvatar: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { buffer, mimeType } = await userService.getAvatarFile(requireActorId(req));
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'private, max-age=60');
      res.status(200).send(buffer);
    } catch (err) {
      next(err);
    }
  },
};
