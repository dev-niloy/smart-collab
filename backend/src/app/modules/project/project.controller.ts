import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { projectService, type Actor } from './project.service';
import type { ListProjectsQuery } from './project.validation';
import { taskService } from '../task/task.service';
import type { ListTasksQuery } from '../task/task.validation';

const getActor = (req: Request): Actor | undefined =>
  req.user ? { id: req.user.id, role: req.user.role } : undefined;

export const projectController = {
  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id;
      if (!actorId) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const project = await projectService.create(req.body, actorId);
      res.status(201).json({ project });
    } catch (err) {
      next(err);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query as unknown as ListProjectsQuery;
      const result = await projectService.list({
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
      const project = await projectService.findById(req.params.id, getActor(req));
      res.status(200).json({ project });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id ?? null;
      const project = await projectService.update(req.params.id, req.body, actorId);
      res.status(200).json({ project });
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id ?? null;
      await projectService.remove(req.params.id, actorId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  listTasks: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = getActor(req);
      await projectService.findById(req.params.id, actor); // 404 if missing, 403 if not member
      const query = req.query as unknown as ListTasksQuery;
      const result = await taskService.list({
        ...query,
        projectId: req.params.id,
        actorId: req.user?.id,
        actor,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};
