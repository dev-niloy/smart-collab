import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { dashboardService } from './dashboard.service';
import type { ProductivityQuery, UpcomingQuery } from './dashboard.validation';

const scopeFromReq = (req: Request) => {
  const actorId = req.user?.id;
  if (!actorId) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
  const projectId = req.params.id;
  return { actorId, ...(projectId ? { projectId } : {}) };
};

export const dashboardController = {
  kpis: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await dashboardService.getKpis(scopeFromReq(req));
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  },
  status: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await dashboardService.getStatusCounts(scopeFromReq(req));
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  },
  priority: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await dashboardService.getPriorityCounts(scopeFromReq(req));
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  },
  productivity: async (req: Request, res: Response, next: NextFunction) => {
    try {
      // validate middleware has already parsed + defaulted via productivityQuerySchema.
      const { days } = req.query as unknown as ProductivityQuery;
      const data = await dashboardService.getProductivity(scopeFromReq(req), days);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },
  upcoming: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { days } = req.query as unknown as UpcomingQuery;
      const data = await dashboardService.getUpcoming(scopeFromReq(req), days);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  },
  highPriority: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await dashboardService.getHighPriority(scopeFromReq(req));
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },
};
