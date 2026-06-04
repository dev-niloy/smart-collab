import type { RequestHandler } from 'express';
import type { ProjectRole } from '@prisma/client';
import { ApiError } from '../errors/ApiError';
import { projectMemberService } from '../modules/projectMember/projectMember.service';
import {
  ERR_FORBIDDEN_PROJECT_ROLE,
  FORBIDDEN_PROJECT_ROLE_MESSAGE,
} from '../modules/projectMember/projectMember.constant';

// Checks the actor has at least the required project role on the project
// identified by `req.params.id`. System `admin` always bypasses.
// Caches the resolved role on req.projectRole to avoid double-fetch later.
declare module 'express-serve-static-core' {
  interface Request {
    projectRole?: ProjectRole | 'admin';
  }
}

const rank = (role: ProjectRole | 'admin'): number => {
  if (role === 'admin') return 100;
  if (role === 'pm') return 10;
  return 1;
};

export const requireProjectRole = (required: ProjectRole): RequestHandler => {
  return async (req, _res, next) => {
    try {
      if (!req.user) {
        return next(ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED'));
      }
      const projectId = req.params.id;
      if (!projectId) {
        return next(ApiError.badRequest('Missing project id', 'MISSING_PROJECT_ID'));
      }
      if (req.user.role === 'admin') {
        req.projectRole = 'admin';
        return next();
      }
      const role = await projectMemberService.getProjectRole(projectId, req.user.id);
      if (!role || rank(role) < rank(required)) {
        return next(
          ApiError.forbidden(FORBIDDEN_PROJECT_ROLE_MESSAGE, ERR_FORBIDDEN_PROJECT_ROLE),
        );
      }
      req.projectRole = role;
      return next();
    } catch (err) {
      return next(err);
    }
  };
};
