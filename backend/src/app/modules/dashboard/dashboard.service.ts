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

export type StatusCounts = { todo: number; in_progress: number; completed: number };
export type PriorityCounts = { low: number; medium: number; high: number };

const STATUS_KEYS: (keyof StatusCounts)[] = ['todo', 'in_progress', 'completed'];
const PRIORITY_KEYS: (keyof PriorityCounts)[] = ['low', 'medium', 'high'];

const zeroFill = <K extends string>(
  keys: readonly K[],
  rows: { key: K; count: number }[],
): Record<K, number> => {
  const out = {} as Record<K, number>;
  for (const k of keys) out[k] = 0;
  for (const r of rows) {
    if ((keys as readonly string[]).includes(r.key)) out[r.key] = r.count;
  }
  return out;
};

const getStatusCounts = async (scope: Scope): Promise<StatusCounts> => {
  const rows = await prisma.task.groupBy({
    by: ['status'],
    where: taskWhere(scope),
    _count: { _all: true },
  });
  return zeroFill(STATUS_KEYS, rows.map((r) => ({ key: r.status as keyof StatusCounts, count: r._count?._all ?? 0 })));
};

const getPriorityCounts = async (scope: Scope): Promise<PriorityCounts> => {
  const rows = await prisma.task.groupBy({
    by: ['priority'],
    where: taskWhere(scope),
    _count: { _all: true },
  });
  return zeroFill(PRIORITY_KEYS, rows.map((r) => ({ key: r.priority as keyof PriorityCounts, count: r._count?._all ?? 0 })));
};

export const dashboardService = {
  getKpis,
  getStatusCounts,
  getPriorityCounts,
  _taskWhere: taskWhere,
  _projectWhere: projectWhere,
};
