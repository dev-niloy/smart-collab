import type { RequestHandler } from 'express';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import { projectMemberService } from '../projectMember/projectMember.service';

// Resolves the project for a :taskId route param, then ensures the caller is
// a system admin or a member of that project. Caches resolved role on
// req.projectRole for downstream handlers.
export const requireTaskAccess: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) {
      return next(ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED'));
    }
    const taskId = req.params.taskId;
    if (!taskId) return next(ApiError.badRequest('Missing task id', 'MISSING_TASK_ID'));
    const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
    if (!task) return next(ApiError.notFound('Task not found', 'TASK_NOT_FOUND'));
    if (req.user.role === 'admin') {
      req.projectRole = 'admin';
      return next();
    }
    const role = await projectMemberService.getProjectRole(task.projectId, req.user.id);
    if (!role) return next(ApiError.forbidden('Not a project member', 'FORBIDDEN_PROJECT_ROLE'));
    req.projectRole = role;
    return next();
  } catch (err) {
    return next(err);
  }
};
