import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { invitationService } from './invitation.service';

const requireActorId = (req: Request): string => {
  const id = req.user?.id;
  if (!id) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
  return id;
};

export const invitationController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.id;
      const data = await invitationService.listForProject(projectId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },

  create: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.id;
      const actorId = requireActorId(req);
      const { email, role } = req.body as { email: string; role: 'pm' | 'member' };
      const data = await invitationService.createInvitation({
        projectId,
        email,
        role: role ?? 'member',
        actorId,
      });
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  },

  revoke: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.id;
      const invitationId = req.params.invitationId;
      const actorId = requireActorId(req);
      const data = await invitationService.revokeInvitation({
        projectId,
        invitationId,
        actorId,
      });
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },

  lookup: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.params.token;
      const data = await invitationService.lookupByToken(token);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },

  accept: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = req.params.token;
      const actorId = requireActorId(req);
      const data = await invitationService.acceptByToken({ token, userId: actorId });
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },
};
