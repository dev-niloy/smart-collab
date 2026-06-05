import { Role, type Task, type TaskStatus, type TaskPriority, type Prisma } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import { type Actor, isAdmin, assertProjectAccess } from '../project/project.service';
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
import { enqueue as enqueueNotification } from '../notification/notification.service';
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

// ──────────────────────────────────────────────────────────
// Task write permission predicates (task-assignee-write)
// ──────────────────────────────────────────────────────────

type CanWriteArgs = {
  actor: Actor | undefined;
  task: Pick<Task, 'assignedTo' | 'createdBy'>;
  projectRole?: 'pm' | 'member' | null; // resolved per-project; null = not a member
};

/**
 * Returns true when the actor may edit task fields (status / title / desc / priority / due).
 * Admin and project PM are always allowed. Assignee is allowed only when the task IS assigned to them.
 * Unassigned tasks cannot be field-edited by anyone except admin / project PM.
 */
export const canWriteTask = ({ actor, task, projectRole }: CanWriteArgs): boolean => {
  if (isAdmin(actor)) return true;
  if (projectRole === 'pm') return true;
  if (!task.assignedTo) return false; // unassigned → admin / PM only
  return !!actor && task.assignedTo === actor.id;
};

/**
 * Returns true when the actor may delete the task (soft delete).
 * Admin, project PM, or the task creator (any role) can delete.
 */
export const canDeleteTask = ({ actor, task, projectRole }: CanWriteArgs): boolean => {
  if (isAdmin(actor)) return true;
  if (projectRole === 'pm') return true;
  return !!actor && task.createdBy === actor.id;
};

/**
 * Returns true when the actor may reassign the task (change assignedTo).
 * PM/admin only — assignee CANNOT reassign out.
 */
export const canReassignTask = ({ actor, projectRole }: Omit<CanWriteArgs, 'task'>): boolean => {
  if (isAdmin(actor)) return true;
  return projectRole === 'pm';
};

/**
 * Returns true when the actor may see soft-deleted tasks.
 * PM/admin only — non-PM passing includeDeleted=true is silently ignored.
 */
export const canSeeDeleted = (actor: Actor | undefined, projectRole?: 'pm' | 'member' | null): boolean => {
  if (isAdmin(actor)) return true;
  return projectRole === 'pm';
};

/**
 * Look up a single user's project role from ProjectMember. Returns null if not a member.
 */
export const getProjectRoleFor = async (
  actor: Actor | undefined,
  projectId: string,
): Promise<'pm' | 'member' | null> => {
  if (!actor) return null;
  if (isAdmin(actor)) return null; // admin bypasses projectMember entirely
  const row = await prisma.projectMember.findFirst({
    where: { projectId, userId: actor.id },
    select: { role: true },
  });
  return row?.role ?? null;
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
      if (task.assignedTo) {
        await enqueueNotification(tx, {
          recipientId: task.assignedTo,
          actorId,
          type: 'task.assigned',
          entityType: 'task',
          entityId: task.id,
          projectId: task.projectId,
          payload: { taskTitle: task.title, taskId: task.id, projectId: task.projectId },
        });
      }
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

const findById = async (id: string, actor?: Actor): Promise<TaskWithRelations> => {
  const t = await prisma.task.findUnique({ where: { id }, include: taskInclude });
  if (!t || t.deletedAt) throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');
  await assertProjectAccess(actor, t.projectId);
  return t;
};

const update = async (
  id: string,
  input: UpdateTaskInput,
  actorId: string | null = null,
  actor?: Actor,
): Promise<TaskWithRelations> => {
  if (input.dueDate) ensureFutureDeadline(input.dueDate);

  const current = await prisma.task.findUnique({
    where: { id },
    select: {
      projectId: true,
      status: true,
      assignedTo: true,
      createdBy: true,
      title: true,
      priority: true,
      deletedAt: true,
    },
  });
  if (!current || current.deletedAt) {
    throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');
  }

  const projectRole = await getProjectRoleFor(actor, current.projectId);

  if (!canWriteTask({ actor, task: current, projectRole })) {
    throw ApiError.forbidden(
      'You do not have permission to update this task.',
      'TASK_WRITE_FORBIDDEN',
    );
  }

  if (input.assignedTo !== undefined && input.assignedTo !== current.assignedTo) {
    if (!canReassignTask({ actor, projectRole })) {
      throw ApiError.forbidden(
        'Only project managers can reassign tasks.',
        'CANNOT_REASSIGN',
      );
    }
  }

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
        if (task.assignedTo) {
          await enqueueNotification(tx, {
            recipientId: task.assignedTo,
            actorId,
            type: 'task.assigned',
            entityType: 'task',
            entityId: task.id,
            projectId: task.projectId,
            payload: { taskTitle: task.title, taskId: task.id, projectId: task.projectId },
          });
        }
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

const remove = async (
  id: string,
  actorId: string | null = null,
  actor?: Actor,
): Promise<void> => {
  try {
    const existing = await prisma.task.findUnique({
      where: { id },
      select: { id: true, projectId: true, title: true, createdBy: true, assignedTo: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');
    }
    const projectRole = await getProjectRoleFor(actor, existing.projectId);
    if (!canDeleteTask({ actor, task: existing, projectRole })) {
      throw ApiError.forbidden(
        'You do not have permission to delete this task.',
        'TASK_DELETE_FORBIDDEN',
      );
    }
    await prisma.$transaction(async (tx) => {
      await recordActivity(tx, {
        actorId,
        action: 'task.deleted',
        entityType: 'task',
        entityId: existing.id,
        projectId: existing.projectId,
        meta: { title: existing.title },
      });
      await tx.task.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (isRecordNotFound(err)) {
      throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');
    }
    throw err;
  }
};

const restore = async (
  id: string,
  actorId: string | null = null,
  actor?: Actor,
): Promise<TaskWithRelations> => {
  const existing = await prisma.task.findUnique({
    where: { id },
    select: { id: true, projectId: true, title: true, deletedAt: true },
  });
  if (!existing) throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');
  if (!existing.deletedAt) {
    throw ApiError.unprocessable('Task is not deleted.', 'NOT_DELETED');
  }
  const projectRole = await getProjectRoleFor(actor, existing.projectId);
  if (!canSeeDeleted(actor, projectRole)) {
    throw ApiError.forbidden(
      'You do not have permission to restore this task.',
      'TASK_RESTORE_FORBIDDEN',
    );
  }
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.update({
      where: { id },
      data: { deletedAt: null },
      include: taskInclude,
    });
    await recordActivity(tx, {
      actorId,
      action: 'task.restored',
      entityType: 'task',
      entityId: task.id,
      projectId: task.projectId,
      meta: { title: task.title },
    });
    return task;
  });
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
  actor?: Actor;
  includeDeleted?: boolean; // PM/admin only; silently ignored otherwise
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
  if (args.projectId) await assertProjectAccess(args.actor, args.projectId);
  const rbacFilter: Prisma.TaskWhereInput | undefined =
    args.projectId || isAdmin(args.actor)
      ? undefined
      : { project: { members: { some: { userId: args.actor!.id } } } };

  // Soft-delete: hide deleted by default; PM/admin can opt in via includeDeleted=true.
  let projectRoleForDeleted: 'pm' | 'member' | null = null;
  if (args.projectId && args.includeDeleted) {
    projectRoleForDeleted = await getProjectRoleFor(args.actor, args.projectId);
  }
  const showDeleted =
    args.includeDeleted === true && canSeeDeleted(args.actor, projectRoleForDeleted);
  const deletedFilter: Prisma.TaskWhereInput = showDeleted
    ? { deletedAt: { not: null } }
    : { deletedAt: null };

  const where: Prisma.TaskWhereInput = {
    ...(args.projectId ? { projectId: args.projectId } : {}),
    ...(args.q ? { title: { contains: args.q, mode: 'insensitive' } } : {}),
    ...(statusFilter !== undefined ? { status: statusFilter } : {}),
    ...(priorityFilter !== undefined ? { priority: priorityFilter } : {}),
    ...(dueDate ? { dueDate } : {}),
    ...buildAssignedToWhere(args.assignedTo, args.actorId),
    ...buildCreatedByWhere(args.createdBy, args.actorId),
    ...(rbacFilter ?? {}),
    ...deletedFilter,
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
  restore,
  list,
  ensureFutureDeadline,
};
