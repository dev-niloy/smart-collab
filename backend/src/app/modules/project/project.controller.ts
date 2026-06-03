import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { projectService } from './project.service';
import type { ListProjectsQuery } from './project.validation';

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
      const result = await projectService.list(query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  getById: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectService.findById(req.params.id);
      res.status(200).json({ project });
    } catch (err) {
      next(err);
    }
  },

  update: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const project = await projectService.update(req.params.id, req.body);
      res.status(200).json({ project });
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      await projectService.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
