import type { Prisma } from '@prisma/client';
import { prisma } from '../../../config/prisma';

export type Scope = { actorId: string; projectId?: string };

export type Kpis = {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  completionPct: number;
  myOpenTasks: number;
};

const taskWhere = (scope: Scope, extra: Prisma.TaskWhereInput = {}): Prisma.TaskWhereInput => ({
  ...(scope.projectId ? { projectId: scope.projectId } : {}),
  ...extra,
});

const projectWhere = (scope: Scope): Prisma.ProjectWhereInput =>
  scope.projectId ? { id: scope.projectId } : {};

const pct = (numer: number, denom: number): number =>
  denom === 0 ? 0 : Math.round((numer / denom) * 100);

const getKpis = async (scope: Scope): Promise<Kpis> => {
  const [totalProjects, totalTasks, completedTasks, myOpenTasks] = await Promise.all([
    prisma.project.count({ where: projectWhere(scope) }),
    prisma.task.count({ where: taskWhere(scope) }),
    prisma.task.count({ where: taskWhere(scope, { status: 'completed' }) }),
    prisma.task.count({
      where: taskWhere(scope, { assignedTo: scope.actorId, status: { not: 'completed' } }),
    }),
  ]);
  return {
    totalProjects,
    totalTasks,
    completedTasks,
    completionPct: pct(completedTasks, totalTasks),
    myOpenTasks,
  };
};

export const dashboardService = {
  getKpis,
  _taskWhere: taskWhere,
  _projectWhere: projectWhere,
};
