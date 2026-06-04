import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { search } from './search.service';
import type { SearchQuery } from './search.validation';

export const searchController = {
  search: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      }
      const { q, limit } = req.query as unknown as SearchQuery;
      const result = await search({ q, limit });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};
