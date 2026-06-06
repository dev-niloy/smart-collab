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
  assignees: {
    include: { user: { select: userSelect } },
    orderBy: { addedAt: 'asc' },
  },
} as const;

export type TaskUserRel = { id: string; email: string; name: string; role: string };
export type TaskAssigneeRel = {
  userId: string;
  addedById: string;
  addedAt: Date;
  user: TaskUserRel;
};

export type TaskWithRelations = Task & {
  creator: TaskUserRel;
  assignee: TaskUserRel | null;
  assignees: TaskAssigneeRel[];
};

/**
 * Map raw TaskAssignee rows (with included user) into ordered TaskUser[] for response shape.
 * Order preserved from query (`addedAt` ascending).
 */
export const mapTaskAssignees = (rows: TaskAssigneeRel[]): TaskUserRel[] =>
  rows.map((r) => r.user);

// ──────────────────────────────────────────────────────────
// Task write permission predicates (task-assignee-write)
// ──────────────────────────────────────────────────────────

type CanWriteArgs = {
  actor: Actor | undefined;
  task: Pick<Task, 'assignedTo' | 'createdBy'> & { assignees?: { userId: string }[] };
  projectRole?: 'pm' | 'member' | null; // resolved per-project; null = not a member
};

/**
 * Returns true when the actor may edit task fields (status / title / desc / priority / due).
 * Admin and project PM are always allowed. Any assignee is allowed (multi-assignee model).
 * Unassigned tasks (no assignees) cannot be field-edited by anyone except admin / project PM.
 * `task.assignees` is preferred when present (multi-assignee). Falls back to legacy `task.assignedTo`
 * during the dual-write transition window (Phase A m1 → Phase F m2).
 */
export const canWriteTask = ({ actor, task, projectRole }: CanWriteArgs): boolean => {
  if (isAdmin(actor)) return true;
  if (projectRole === 'pm') return true;
  if (!actor) return false;
  if (task.assignees && task.assignees.length > 0) {
    return task.assignees.some((a) => a.userId === actor.id);
  }
  if (!task.assignedTo) return false;
  return task.assignedTo === actor.id;
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

/**
 * Normalize create input to the canonical multi-assignee shape.
 * - `assigneeIds: string[]` (preferred, 0..N) takes priority.
 * - Legacy `assignedTo: string | null` is mapped to `[assignedTo]` (or `[]` if null).
 * Validation has already rejected both being present simultaneously.
 */
const normalizeCreateAssignees = (input: CreateTaskInput): string[] => {
  if (input.assigneeIds !== undefined) {
    return Array.from(new Set(input.assigneeIds));
  }
  if (input.assignedTo) return [input.assignedTo];
  return [];
};

const create = async (input: CreateTaskInput, actorId: string): Promise<TaskWithRelations> => {
  ensureFutureDeadline(input.dueDate);
  await ensureProjectExists(input.projectId);
  await ensureTitleUnique(input.projectId, input.title);
  const assigneeIds = normalizeCreateAssignees(input);
  for (const userId of assigneeIds) {
    await ensureAssigneeIsProjectMember(input.projectId, userId);
  }
  const legacyAssignedTo = assigneeIds[0] ?? null;
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
          assignedTo: legacyAssignedTo,
          createdBy: actorId,
          assignees: {
            create: assigneeIds.map((userId) => ({
              userId,
              addedById: actorId,
            })),
          },
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
      for (const userId of assigneeIds) {
        if (userId === actorId) continue;
        await enqueueNotification(tx, {
          recipientId: userId,
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
      assignees: { select: { userId: true } },
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
      // Dual-write transition: if legacy PATCH `assignedTo` changes the assignee, also
      // replace the TaskAssignee row(s) to match the new single-assignee shape.
      // Removed in t21 once frontend is on the new endpoints + column drops.
      if (input.assignedTo !== undefined && input.assignedTo !== current.assignedTo) {
        await tx.taskAssignee.deleteMany({ where: { taskId: id } });
        if (input.assignedTo) {
          await tx.taskAssignee.create({
            data: { taskId: id, userId: input.assignedTo, addedById: actorId ?? current.createdBy },
          });
        }
      }
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
      select: {
        id: true,
        projectId: true,
        title: true,
        createdBy: true,
        assignedTo: true,
        deletedAt: true,
        assignees: { select: { userId: true } },
      },
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

/**
 * `assignedTo` filter. Reads from BOTH legacy `Task.assignedTo` and the new `TaskAssignee` join
 * during the dual-write transition window (Phase A m1 → Phase F m2). After m2 drops the legacy
 * column, the legacy branch becomes dead code and will be removed in t21.
 */
const buildAssignedToWhere = (
  v: ListArgs['assignedTo'],
  actorId: string | undefined,
): Prisma.TaskWhereInput | Record<string, never> => {
  if (!v) return {};
  if (v === UNASSIGNED) {
    return { AND: [{ assignees: { none: {} } }, { assignedTo: null }] };
  }
  if (v === 'me') {
    if (!actorId) return {};
    return {
      OR: [{ assignees: { some: { userId: actorId } } }, { assignedTo: actorId }],
    };
  }
  return { OR: [{ assignees: { some: { userId: v } } }, { assignedTo: v }] };
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

// ──────────────────────────────────────────────────────────
// Assignee management endpoints (Phase C — multi-assignee)
// PM/admin only. Reassign via add/remove/replace, not via PATCH /tasks/:id.
// ──────────────────────────────────────────────────────────

const loadTaskForAssigneeOp = async (taskId: string) => {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      title: true,
      deletedAt: true,
      assignees: { select: { userId: true } },
    },
  });
  if (!t || t.deletedAt) throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');
  return t;
};

const ensureCanReassign = async (actor: Actor | undefined, projectId: string) => {
  const projectRole = await getProjectRoleFor(actor, projectId);
  if (!canReassignTask({ actor, projectRole })) {
    throw ApiError.forbidden(
      'Only project managers can change task assignees.',
      'CANNOT_REASSIGN',
    );
  }
};

const syncLegacyAssignedTo = async (
  tx: Prisma.TransactionClient,
  taskId: string,
): Promise<void> => {
  // During the dual-write transition (Phase A m1 → Phase F m2), keep legacy `assignedTo`
  // synced to the first assignee (by addedAt). Removed in t21 when column drops.
  const first = await tx.taskAssignee.findFirst({
    where: { taskId },
    orderBy: { addedAt: 'asc' },
    select: { userId: true },
  });
  await tx.task.update({
    where: { id: taskId },
    data: { assignedTo: first?.userId ?? null },
  });
};

const addAssignee = async (
  taskId: string,
  userId: string,
  actorId: string,
  actor?: Actor,
): Promise<TaskWithRelations> => {
  const existing = await loadTaskForAssigneeOp(taskId);
  await ensureCanReassign(actor, existing.projectId);
  await ensureAssigneeIsProjectMember(existing.projectId, userId);
  return prisma.$transaction(async (tx) => {
    await tx.taskAssignee.upsert({
      where: { taskId_userId: { taskId, userId } },
      create: { taskId, userId, addedById: actorId },
      update: {}, // idempotent: re-adding existing assignee is a no-op
    });
    await syncLegacyAssignedTo(tx, taskId);
    await recordActivity(tx, {
      actorId,
      action: 'task.assigned',
      entityType: 'task',
      entityId: taskId,
      projectId: existing.projectId,
      meta: { added: userId },
    });
    if (userId !== actorId) {
      await enqueueNotification(tx, {
        recipientId: userId,
        actorId,
        type: 'task.assigned',
        entityType: 'task',
        entityId: taskId,
        projectId: existing.projectId,
        payload: { taskTitle: existing.title, taskId, projectId: existing.projectId },
      });
    }
    const task = await tx.task.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude });
    return task;
  });
};

const removeAssignee = async (
  taskId: string,
  userId: string,
  actorId: string,
  actor?: Actor,
): Promise<TaskWithRelations> => {
  const existing = await loadTaskForAssigneeOp(taskId);
  await ensureCanReassign(actor, existing.projectId);
  return prisma.$transaction(async (tx) => {
    await tx.taskAssignee
      .delete({ where: { taskId_userId: { taskId, userId } } })
      .catch((err) => {
        if (isRecordNotFound(err)) return; // idempotent: removing non-assignee = no-op
        throw err;
      });
    await syncLegacyAssignedTo(tx, taskId);
    await recordActivity(tx, {
      actorId,
      action: 'task.assigned',
      entityType: 'task',
      entityId: taskId,
      projectId: existing.projectId,
      meta: { removed: userId },
    });
    if (userId !== actorId) {
      await enqueueNotification(tx, {
        recipientId: userId,
        actorId,
        type: 'task.unassigned',
        entityType: 'task',
        entityId: taskId,
        projectId: existing.projectId,
        payload: { taskTitle: existing.title, taskId, projectId: existing.projectId },
      });
    }
    const task = await tx.task.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude });
    return task;
  });
};

const replaceAssignees = async (
  taskId: string,
  userIds: string[],
  actorId: string,
  actor?: Actor,
): Promise<TaskWithRelations> => {
  const existing = await loadTaskForAssigneeOp(taskId);
  await ensureCanReassign(actor, existing.projectId);
  const next = Array.from(new Set(userIds));
  // Atomic membership validation BEFORE any write — partial apply not allowed.
  for (const id of next) {
    await ensureAssigneeIsProjectMember(existing.projectId, id);
  }
  const current = new Set(existing.assignees.map((a) => a.userId));
  const nextSet = new Set(next);
  const toAdd = next.filter((id) => !current.has(id));
  const toRemove = Array.from(current).filter((id) => !nextSet.has(id));
  return prisma.$transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx.taskAssignee.deleteMany({
        where: { taskId, userId: { in: toRemove } },
      });
    }
    if (toAdd.length > 0) {
      await tx.taskAssignee.createMany({
        data: toAdd.map((userId) => ({ taskId, userId, addedById: actorId })),
        skipDuplicates: true,
      });
    }
    await syncLegacyAssignedTo(tx, taskId);
    if (toAdd.length > 0 || toRemove.length > 0) {
      await recordActivity(tx, {
        actorId,
        action: 'task.assigned',
        entityType: 'task',
        entityId: taskId,
        projectId: existing.projectId,
        meta: { added: toAdd, removed: toRemove },
      });
    }
    for (const userId of toAdd) {
      if (userId === actorId) continue;
      await enqueueNotification(tx, {
        recipientId: userId,
        actorId,
        type: 'task.assigned',
        entityType: 'task',
        entityId: taskId,
        projectId: existing.projectId,
        payload: { taskTitle: existing.title, taskId, projectId: existing.projectId },
      });
    }
    for (const userId of toRemove) {
      if (userId === actorId) continue;
      await enqueueNotification(tx, {
        recipientId: userId,
        actorId,
        type: 'task.unassigned',
        entityType: 'task',
        entityId: taskId,
        projectId: existing.projectId,
        payload: { taskTitle: existing.title, taskId, projectId: existing.projectId },
      });
    }
    const task = await tx.task.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude });
    return task;
  });
};

export const taskService = {
  create,
  findById,
  update,
  remove,
  restore,
  list,
  addAssignee,
  removeAssignee,
  replaceAssignees,
  ensureFutureDeadline,
};
