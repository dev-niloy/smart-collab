import type { RequestHandler } from 'express';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';

// Admin + PM bypass. Member must be creator OR assignee of the task.
export const requireTaskOwnerOrPrivileged: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) {
      return next(ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED'));
    }
    if (req.user.role === 'admin' || req.user.role === 'project_manager') {
      return next();
    }
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      select: {
        createdBy: true,
        assignedTo: true,
        assignees: { select: { userId: true } },
      },
    });
    if (!task) {
      return next(ApiError.notFound('Task not found', 'TASK_NOT_FOUND'));
    }
    const actorId = req.user.id;
    if (
      task.createdBy === actorId ||
      task.assignedTo === actorId ||
      task.assignees.some((a) => a.userId === actorId)
    ) {
      return next();
    }
    return next(ApiError.forbidden('Insufficient permissions for this task', 'FORBIDDEN_OWNERSHIP'));
  } catch (err) {
    return next(err);
  }
};
