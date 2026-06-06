import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { taskService } from './task.service';
import type { Actor } from '../project/project.service';
import {
  hasAssigneeKeys,
  USE_ASSIGNEE_ENDPOINTS_MESSAGE,
  type ListTasksQuery,
} from './task.validation';

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
      if (hasAssigneeKeys(req.body)) {
        throw ApiError.unprocessable(USE_ASSIGNEE_ENDPOINTS_MESSAGE, 'USE_ASSIGNEE_ENDPOINTS');
      }
      const actorId = req.user?.id ?? null;
      const task = await taskService.update(req.params.id, req.body, actorId, getActor(req));
      res.status(200).json({ task });
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id ?? null;
      await taskService.remove(req.params.id, actorId, getActor(req));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  restore: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id ?? null;
      const task = await taskService.restore(req.params.id, actorId, getActor(req));
      res.status(200).json({ task });
    } catch (err) {
      next(err);
    }
  },

  addAssignee: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id;
      if (!actorId) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const { userId } = req.body as { userId: string };
      const task = await taskService.addAssignee(req.params.id, userId, actorId, getActor(req));
      res.status(201).json({ task });
    } catch (err) {
      next(err);
    }
  },

  removeAssignee: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id;
      if (!actorId) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const task = await taskService.removeAssignee(
        req.params.id,
        req.params.userId,
        actorId,
        getActor(req),
      );
      res.status(200).json({ task });
    } catch (err) {
      next(err);
    }
  },

  replaceAssignees: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id;
      if (!actorId) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const { userIds } = req.body as { userIds: string[] };
      const task = await taskService.replaceAssignees(
        req.params.id,
        userIds,
        actorId,
        getActor(req),
      );
      res.status(200).json({ task });
    } catch (err) {
      next(err);
    }
  },
};
