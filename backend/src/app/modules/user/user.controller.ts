import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../config/prisma';

export const userController = {
  list: async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await prisma.user.findMany({
        select: { id: true, email: true, name: true, role: true },
        orderBy: { name: 'asc' },
      });
      res.status(200).json({ data: users });
    } catch (err) {
      next(err);
    }
  },
};
