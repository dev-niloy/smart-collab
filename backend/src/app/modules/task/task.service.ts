import { Role, type Task, type TaskStatus, type TaskPriority, type Prisma } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import {
  PAST_DEADLINE_MESSAGE,
  DUPLICATE_TASK_TITLE_MESSAGE,
  REASSIGN_COMPLETED_MESSAGE,
  ASSIGNEE_NOT_PROJECT_MEMBER_MESSAGE,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  UNASSIGNED,
  type SortKey,
} from './task.constant';
import type { CreateTaskInput, UpdateTaskInput } from './task.validation';
import { recordActivity } from '../activityLog/activityLog.service';
import { arrayOrEq } from '../../lib/queryFields';

const ensureFutureDeadline = (dueDate: Date) => {
  if (dueDate.getTime() < Date.now()) {
    throw ApiError.unprocessable(PAST_DEADLINE_MESSAGE, 'PAST_DEADLINE');
  }
};

const isRecordNotFound = (err: unknown): boolean => {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2025';
};

const isUniqueViolation = (err: unknown): boolean => {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002';
};

const userSelect = { id: true, email: true, name: true, role: true } as const;

const taskInclude = {
  creator: { select: userSelect },
  assignee: { select: userSelect },
} as const;

export type TaskWithRelations = Task & {
  creator: { id: string; email: string; name: string; role: string };
  assignee: { id: string; email: string; name: string; role: string } | null;
};

const ensureAssigneeIsProjectMember = async (
  projectId: string,
  assignedTo: string | null | undefined,
) => {
  if (!assignedTo) return; // null/undefined always allowed (unassigned)
  const candidate = await prisma.user.findUnique({
    where: { id: assignedTo },
    select: { role: true },
  });
  if (!candidate) {
    throw ApiError.unprocessable(ASSIGNEE_NOT_PROJECT_MEMBER_MESSAGE, 'ASSIGNEE_NOT_PROJECT_MEMBER');
  }
  if (candidate.role === Role.admin) return; // system admin bypass — enum-safe vs string drift
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId: assignedTo },
    select: { id: true },
  });
  if (!member) {
    throw ApiError.unprocessable(ASSIGNEE_NOT_PROJECT_MEMBER_MESSAGE, 'ASSIGNEE_NOT_PROJECT_MEMBER');
  }
};

const ensureProjectExists = async (projectId: string) => {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!p) throw ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND');
};

const ensureTitleUnique = async (projectId: string, title: string, excludeTaskId?: string) => {
  const existing = await prisma.task.findFirst({
    where: {
      projectId,
      title: { equals: title, mode: 'insensitive' },
      ...(excludeTaskId ? { NOT: { id: excludeTaskId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw ApiError.unprocessable(DUPLICATE_TASK_TITLE_MESSAGE, 'DUPLICATE_TASK_TITLE');
  }
};

const create = async (input: CreateTaskInput, actorId: string): Promise<TaskWithRelations> => {
  ensureFutureDeadline(input.dueDate);
  await ensureProjectExists(input.projectId);
  await ensureTitleUnique(input.projectId, input.title);
  await ensureAssigneeIsProjectMember(input.projectId, input.assignedTo ?? null);
  try {
    return await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          description: input.description ?? null,
          dueDate: input.dueDate,
          status: input.status,
          priority: input.priority,
          assignedTo: input.assignedTo ?? null,
          createdBy: actorId,
        },
        include: taskInclude,
      });
      await recordActivity(tx, {
        actorId,
        action: 'task.created',
        entityType: 'task',
        entityId: task.id,
        projectId: task.projectId,
        meta: { title: task.title, status: task.status, priority: task.priority },
      });
      return task;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Race: another insert won between ensureTitleUnique and create.
      throw ApiError.unprocessable(DUPLICATE_TASK_TITLE_MESSAGE, 'DUPLICATE_TASK_TITLE');
    }
    throw err;
  }
};

const findById = async (id: string): Promise<TaskWithRelations> => {
  const t = await prisma.task.findUnique({ where: { id }, include: taskInclude });
  if (!t) throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');
  return t;
};

const update = async (
  id: string,
  input: UpdateTaskInput,
  actorId: string | null = null,
): Promise<TaskWithRelations> => {
  if (input.dueDate) ensureFutureDeadline(input.dueDate);

  const current = await prisma.task.findUnique({
    where: { id },
    select: { projectId: true, status: true, assignedTo: true, title: true, priority: true },
  });
  if (!current) throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');

  if (input.title !== undefined && input.title.toLowerCase() !== current.title.toLowerCase()) {
    await ensureTitleUnique(current.projectId, input.title, id);
  }

  if (input.assignedTo !== undefined && input.assignedTo !== current.assignedTo) {
    const finalStatus = input.status ?? current.status;
    if (finalStatus === 'completed') {
      throw ApiError.unprocessable(REASSIGN_COMPLETED_MESSAGE, 'REASSIGN_COMPLETED');
    }
    await ensureAssigneeIsProjectMember(current.projectId, input.assignedTo);
  }

  // Detect changed fields up-front so we can decide whether to emit task.updated.
  const fieldChanged =
    (input.title !== undefined && input.title !== current.title) ||
    input.description !== undefined ||
    input.dueDate !== undefined ||
    (input.status !== undefined && input.status !== current.status) ||
    (input.priority !== undefined && input.priority !== current.priority) ||
    (input.assignedTo !== undefined && input.assignedTo !== current.assignedTo);

  try {
    return await prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo } : {}),
        },
        include: taskInclude,
      });

      if (fieldChanged) {
        await recordActivity(tx, {
          actorId,
          action: 'task.updated',
          entityType: 'task',
          entityId: task.id,
          projectId: task.projectId,
          meta: {
            title: task.title,
            status: task.status,
            priority: task.priority,
          },
        });
      }

      if (input.status !== undefined && input.status !== current.status) {
        await recordActivity(tx, {
          actorId,
          action: 'task.status_changed',
          entityType: 'task',
          entityId: task.id,
          projectId: task.projectId,
          meta: { from: current.status, to: task.status },
        });
      }

      if (input.assignedTo !== undefined && input.assignedTo !== current.assignedTo) {
        await recordActivity(tx, {
          actorId,
          action: 'task.assigned',
          entityType: 'task',
          entityId: task.id,
          projectId: task.projectId,
          meta: { from: current.assignedTo ?? undefined, to: task.assignedTo ?? undefined },
        });
      }

      return task;
    });
  } catch (err) {
    if (isRecordNotFound(err)) {
      throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');
    }
    if (isUniqueViolation(err)) {
      throw ApiError.unprocessable(DUPLICATE_TASK_TITLE_MESSAGE, 'DUPLICATE_TASK_TITLE');
    }
    throw err;
  }
};

const remove = async (id: string, actorId: string | null = null): Promise<void> => {
  try {
    const existing = await prisma.task.findUnique({
      where: { id },
      select: { id: true, projectId: true, title: true },
    });
    if (!existing) throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');
    await prisma.$transaction(async (tx) => {
      await recordActivity(tx, {
        actorId,
        action: 'task.deleted',
        entityType: 'task',
        entityId: existing.id,
        projectId: existing.projectId,
        meta: { title: existing.title },
      });
      await tx.task.delete({ where: { id } });
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (isRecordNotFound(err)) {
      throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');
    }
    throw err;
  }
};

type ListArgs = {
  projectId?: string;
  q?: string;
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  assignedTo?: string | typeof UNASSIGNED | 'me';
  createdBy?: string | 'me';
  dueFrom?: Date;
  dueTo?: Date;
  actorId?: string; // used to resolve 'me' shorthands
  sort: SortKey;
  page: number;
  limit: number;
};

type ListResult = {
  data: TaskWithRelations[];
  total: number;
  page: number;
  limit: number;
};

const sortToOrderBy = (sort: SortKey): Prisma.TaskOrderByWithRelationInput[] => {
  switch (sort) {
    case 'dueDate':
      return [{ dueDate: 'asc' }];
    case 'priority':
      // Postgres enum order matches declaration: low < medium < high. Want H first.
      return [{ priority: 'desc' }, { createdAt: 'desc' }];
    case 'updated':
      return [{ updatedAt: 'desc' }];
    case 'created':
    default:
      return [{ createdAt: 'desc' }];
  }
};

const buildAssignedToWhere = (
  v: ListArgs['assignedTo'],
  actorId: string | undefined,
): Prisma.TaskWhereInput | Record<string, never> => {
  if (!v) return {};
  if (v === UNASSIGNED) return { assignedTo: null };
  if (v === 'me') return actorId ? { assignedTo: actorId } : {};
  return { assignedTo: v };
};

const buildCreatedByWhere = (
  v: ListArgs['createdBy'],
  actorId: string | undefined,
): Prisma.TaskWhereInput | Record<string, never> => {
  if (!v) return {};
  if (v === 'me') return actorId ? { createdBy: actorId } : {};
  return { createdBy: v };
};

const list = async (args: ListArgs): Promise<ListResult> => {
  const page = args.page || DEFAULT_PAGE;
  const limit = args.limit || DEFAULT_LIMIT;
  const statusFilter = arrayOrEq(args.status);
  const priorityFilter = arrayOrEq(args.priority);
  const dueDate: Prisma.DateTimeFilter | undefined =
    args.dueFrom || args.dueTo
      ? {
          ...(args.dueFrom ? { gte: args.dueFrom } : {}),
          ...(args.dueTo ? { lte: args.dueTo } : {}),
        }
      : undefined;
  const where: Prisma.TaskWhereInput = {
    ...(args.projectId ? { projectId: args.projectId } : {}),
    ...(args.q ? { title: { contains: args.q, mode: 'insensitive' } } : {}),
    ...(statusFilter !== undefined ? { status: statusFilter } : {}),
    ...(priorityFilter !== undefined ? { priority: priorityFilter } : {}),
    ...(dueDate ? { dueDate } : {}),
    ...buildAssignedToWhere(args.assignedTo, args.actorId),
    ...buildCreatedByWhere(args.createdBy, args.actorId),
  };
  const [data, total] = await prisma.$transaction([
    prisma.task.findMany({
      where,
      orderBy: sortToOrderBy(args.sort),
      skip: (page - 1) * limit,
      take: limit,
      include: taskInclude,
    }),
    prisma.task.count({ where }),
  ]);
  return { data, total, page, limit };
};

export const taskService = {
  create,
  findById,
  update,
  remove,
  list,
  ensureFutureDeadline,
};
