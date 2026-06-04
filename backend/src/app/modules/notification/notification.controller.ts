import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { notificationService } from './notification.service';
import type { ListNotificationsQuery } from './notification.validation';

export const notificationController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const q = req.query as unknown as ListNotificationsQuery;
      const page = await notificationService.listForUser(req.user.id, {
        limit: q.limit,
        cursor: q.cursor,
        unread: q.unread,
      });
      res.status(200).json(page);
    } catch (err) {
      next(err);
    }
  },

  unreadCount: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const count = await notificationService.countUnread(req.user.id);
      res.status(200).json({ count });
    } catch (err) {
      next(err);
    }
  },

  markRead: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const dto = await notificationService.markRead(req.params.id, req.user.id);
      res.status(200).json({ notification: dto });
    } catch (err) {
      next(err);
    }
  },

  markAllRead: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const result = await notificationService.markAllRead(req.user.id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};
