import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { prisma } from '../../../config/prisma';
import { listGlobal, listByProject } from './activityLog.service';
import type { ListActivityQuery } from './activityLog.validation';

const requireActor = (req: Request) => {
  const id = req.user?.id;
  if (!id) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
  return id;
};

export const activityLogController = {
  listGlobal: async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireActor(req);
      const { limit, cursor } = req.query as unknown as ListActivityQuery;
      const page = await listGlobal({ limit, cursor });
      res.status(200).json(page);
    } catch (err) {
      if (err instanceof Error && /Invalid cursor/i.test(err.message)) {
        return next(ApiError.unprocessable('Invalid cursor', 'INVALID_CURSOR'));
      }
      next(err);
    }
  },

  listByProject: async (req: Request, res: Response, next: NextFunction) => {
    try {
      requireActor(req);
      const projectId = req.params.id;
      const exists = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!exists) {
        return next(ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND'));
      }
      const { limit, cursor } = req.query as unknown as ListActivityQuery;
      const page = await listByProject(projectId, { limit, cursor });
      res.status(200).json(page);
    } catch (err) {
      if (err instanceof Error && /Invalid cursor/i.test(err.message)) {
        return next(ApiError.unprocessable('Invalid cursor', 'INVALID_CURSOR'));
      }
      next(err);
    }
  },
};
