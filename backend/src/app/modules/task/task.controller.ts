import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { taskService } from './task.service';
import type { Actor } from '../project/project.service';
import type { ListTasksQuery } from './task.validation';

const getActor = (req: Request): Actor | undefined =>
  req.user ? { id: req.user.id, role: req.user.role } : undefined;

export const taskController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id;
      if (!actorId) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const task = await taskService.create(req.body, actorId);
      res.status(201).json({ task });
    } catch (err) {
      next(err);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as ListTasksQuery;
      const result = await taskService.list({
        ...query,
        actorId: req.user?.id,
        actor: getActor(req),
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const task = await taskService.findById(req.params.id, getActor(req));
      res.status(200).json({ task });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id ?? null;
      const task = await taskService.update(req.params.id, req.body, actorId);
      res.status(200).json({ task });
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id ?? null;
      await taskService.remove(req.params.id, actorId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
