import type { Task, TaskStatus, TaskPriority, Prisma } from '@prisma/client';
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
  if (candidate.role === 'admin') return; // system admin bypass
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
    return await prisma.task.create({
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

const update = async (id: string, input: UpdateTaskInput): Promise<TaskWithRelations> => {
  if (input.dueDate) ensureFutureDeadline(input.dueDate);

  const current = await prisma.task.findUnique({
    where: { id },
    select: { projectId: true, status: true, assignedTo: true, title: true },
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

  try {
    return await prisma.task.update({
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

const remove = async (id: string): Promise<void> => {
  try {
    await prisma.task.delete({ where: { id } });
  } catch (err) {
    if (isRecordNotFound(err)) {
      throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');
    }
    throw err;
  }
};

type ListArgs = {
  projectId?: string;
  q?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedTo?: string | typeof UNASSIGNED;
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
): Prisma.TaskWhereInput | Record<string, never> => {
  if (!v) return {};
  if (v === UNASSIGNED) return { assignedTo: null };
  return { assignedTo: v };
};

const list = async (args: ListArgs): Promise<ListResult> => {
  const page = args.page || DEFAULT_PAGE;
  const limit = args.limit || DEFAULT_LIMIT;
  const where: Prisma.TaskWhereInput = {
    ...(args.projectId ? { projectId: args.projectId } : {}),
    ...(args.q ? { title: { contains: args.q, mode: 'insensitive' } } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(args.priority ? { priority: args.priority } : {}),
    ...buildAssignedToWhere(args.assignedTo),
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
