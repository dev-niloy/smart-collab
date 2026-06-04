import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { projectMemberService } from './projectMember.service';

export const projectMemberController = {
  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.id;
      const data = await projectMemberService.listMembers(projectId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },

  listAssignable: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.id;
      const data = await projectMemberService.listAssignable(projectId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },

  add: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = req.user?.id;
      if (!actorId) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const projectId = req.params.id;
      const { email, role } = req.body;
      const member = await projectMemberService.addMember(projectId, email, role, actorId);
      res.status(201).json({ member });
    } catch (err) {
      next(err);
    }
  },

  updateRole: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.id;
      const memberId = req.params.memberId;
      const { role } = req.body;
      const member = await projectMemberService.updateRole(projectId, memberId, role);
      res.status(200).json({ member });
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.id;
      const memberId = req.params.memberId;
      const out = await projectMemberService.removeMember(projectId, memberId);
      res.status(200).json(out);
    } catch (err) {
      next(err);
    }
  },
};
