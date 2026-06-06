import type { Project, ProjectStatus, Prisma } from '@prisma/client';
import { Role, TaskStatus } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';

export type Actor = { id: string; role: Role };

export const isAdmin = (actor: Actor | undefined): boolean =>
  !actor || actor.role === Role.admin;

export const memberFilter = (actor: Actor | undefined): Prisma.ProjectWhereInput | undefined =>
  isAdmin(actor) ? undefined : { members: { some: { userId: actor!.id } } };

export const assertProjectAccess = async (
  actor: Actor | undefined,
  projectId: string,
): Promise<void> => {
  if (isAdmin(actor)) return;
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId: actor!.id },
    select: { id: true },
  });
  if (!member) {
    throw ApiError.forbidden('You do not have access to this project.', 'FORBIDDEN');
  }
};
import { PAST_DEADLINE_MESSAGE, DEFAULT_LIMIT, DEFAULT_PAGE, type SortKey } from './project.constant';
import type { CreateProjectInput, UpdateProjectInput } from './project.validation';
import { recordActivity } from '../activityLog/activityLog.service';
import { arrayOrEq } from '../../lib/queryFields';

export type Progress = { done: number; total: number; percent: number };

export const computeProgress = (done: number, total: number): Progress => {
  const safeDone = Math.max(0, done);
  const safeTotal = Math.max(0, total);
  const percent = safeTotal === 0 ? 0 : Math.round((safeDone / safeTotal) * 100);
  return { done: safeDone, total: safeTotal, percent };
};

const fetchProgressMap = async (projectIds: string[]): Promise<Map<string, Progress>> => {
  const map = new Map<string, Progress>();
  if (projectIds.length === 0) return map;
  const counts = await prisma.task.groupBy({
    by: ['projectId', 'status'],
    where: { projectId: { in: projectIds } },
    _count: { _all: true },
  });
  const totals = new Map<string, number>();
  const dones = new Map<string, number>();
  for (const row of counts) {
    const c = row._count._all;
    totals.set(row.projectId, (totals.get(row.projectId) ?? 0) + c);
    if (row.status === TaskStatus.completed) {
      dones.set(row.projectId, (dones.get(row.projectId) ?? 0) + c);
    }
  }
  for (const id of projectIds) {
    map.set(id, computeProgress(dones.get(id) ?? 0, totals.get(id) ?? 0));
  }
  return map;
};

const ensureFutureDeadline = (deadline: Date) => {
  if (deadline.getTime() < Date.now()) {
    throw ApiError.unprocessable(PAST_DEADLINE_MESSAGE, 'PAST_DEADLINE');
  }
};

const isRecordNotFound = (err: unknown): boolean => {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2025';
};

const creatorInclude = {
  creator: { select: { id: true, email: true, name: true } },
} as const;

export type ProjectWithCreator = Project & {
  creator: { id: string; email: string; name: string };
  progress: Progress;
};

const create = async (input: CreateProjectInput, actorId: string): Promise<ProjectWithCreator> => {
  ensureFutureDeadline(input.deadline);
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        deadline: input.deadline,
        status: input.status,
        createdBy: actorId,
      },
      include: creatorInclude,
    });
    // Auto-add creator as project pm (team-members subgoal §C12).
    await tx.projectMember.create({
      data: { projectId: project.id, userId: actorId, role: 'pm', addedById: actorId },
    });
    await recordActivity(tx, {
      actorId,
      action: 'project.created',
      entityType: 'project',
      entityId: project.id,
      projectId: project.id,
      meta: { name: project.name, status: project.status },
    });
    return { ...project, progress: computeProgress(0, 0) };
  });
};

const findById = async (id: string, actor?: Actor): Promise<ProjectWithCreator> => {
  const p = await prisma.project.findUnique({ where: { id }, include: creatorInclude });
  if (!p) throw ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND');
  await assertProjectAccess(actor, id);
  const progressMap = await fetchProgressMap([id]);
  return { ...p, progress: progressMap.get(id) ?? computeProgress(0, 0) };
};

const update = async (
  id: string,
  input: UpdateProjectInput,
  actorId: string | null = null,
): Promise<ProjectWithCreator> => {
  if (input.deadline) ensureFutureDeadline(input.deadline);
  try {
    return await prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
        include: creatorInclude,
      });
      await recordActivity(tx, {
        actorId,
        action: 'project.updated',
        entityType: 'project',
        entityId: project.id,
        projectId: project.id,
        meta: { name: project.name, status: project.status },
      });
      const progressMap = await fetchProgressMap([project.id]);
      return { ...project, progress: progressMap.get(project.id) ?? computeProgress(0, 0) };
    });
  } catch (err) {
    if (isRecordNotFound(err)) {
      throw ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND');
    }
    throw err;
  }
};

const remove = async (id: string, actorId: string | null = null): Promise<void> => {
  try {
    const existing = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) throw ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND');
    await prisma.$transaction(async (tx) => {
      await recordActivity(tx, {
        actorId,
        action: 'project.deleted',
        entityType: 'project',
        entityId: existing.id,
        projectId: null,
        meta: { name: existing.name },
      });
      await tx.project.delete({ where: { id } });
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (isRecordNotFound(err)) {
      throw ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND');
    }
    throw err;
  }
};

type ListArgs = {
  q?: string;
  status?: ProjectStatus | ProjectStatus[];
  createdBy?: string | 'me';
  deadlineFrom?: Date;
  deadlineTo?: Date;
  actorId?: string;
  actor?: Actor;
  sort: SortKey;
  page: number;
  limit: number;
};

type ListResult = {
  data: ProjectWithCreator[];
  total: number;
  page: number;
  limit: number;
};

const sortToOrderBy = (sort: SortKey): Prisma.ProjectOrderByWithRelationInput => {
  switch (sort) {
    case 'deadline':
      return { deadline: 'asc' };
    case 'updated':
      return { updatedAt: 'desc' };
    case 'created':
    default:
      return { createdAt: 'desc' };
  }
};

const list = async (args: ListArgs): Promise<ListResult> => {
  const page = args.page || DEFAULT_PAGE;
  const limit = args.limit || DEFAULT_LIMIT;
  const statusFilter = arrayOrEq(args.status);
  const deadline: Prisma.DateTimeFilter | undefined =
    args.deadlineFrom || args.deadlineTo
      ? {
          ...(args.deadlineFrom ? { gte: args.deadlineFrom } : {}),
          ...(args.deadlineTo ? { lte: args.deadlineTo } : {}),
        }
      : undefined;
  const createdByResolved =
    args.createdBy === 'me' ? args.actorId : args.createdBy;
  const rbacFilter = memberFilter(args.actor);
  const where: Prisma.ProjectWhereInput = {
    ...(args.q ? { name: { contains: args.q, mode: 'insensitive' } } : {}),
    ...(statusFilter !== undefined ? { status: statusFilter } : {}),
    ...(deadline ? { deadline } : {}),
    ...(createdByResolved ? { createdBy: createdByResolved } : {}),
    ...(rbacFilter ?? {}),
  };
  const [rows, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      orderBy: sortToOrderBy(args.sort),
      skip: (page - 1) * limit,
      take: limit,
      include: creatorInclude,
    }),
    prisma.project.count({ where }),
  ]);
  const progressMap = await fetchProgressMap(rows.map((r) => r.id));
  const data: ProjectWithCreator[] = rows.map((r) => ({
    ...r,
    progress: progressMap.get(r.id) ?? computeProgress(0, 0),
  }));
  return { data, total, page, limit };
};

export const projectService = {
  create,
  findById,
  update,
  remove,
  list,
  ensureFutureDeadline,
};
