import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { commentService } from './comment.service';
import type { ListCommentsQuery } from './comment.validation';

export const commentController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id;
      if (!actorId) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const dto = await commentService.create(req.params.taskId, actorId, req.body.body);
      res.status(201).json({ comment: dto });
    } catch (err) {
      next(err);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query as unknown as ListCommentsQuery;
      const page = await commentService.list(req.params.taskId, { limit: q.limit, cursor: q.cursor });
      res.status(200).json(page);
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const dto = await commentService.update(
        req.params.id,
        { id: req.user.id, role: req.user.role },
        req.body.body,
      );
      res.status(200).json({ comment: dto });
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const projectRole = req.projectRole ?? null;
      await commentService.remove(
        req.params.id,
        { id: req.user.id, role: req.user.role },
        projectRole,
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
