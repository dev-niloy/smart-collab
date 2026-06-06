import { Role, type Task, type TaskStatus, type TaskPriority, type Prisma } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import { type Actor, isAdmin, assertProjectAccess } from '../project/project.service';
import {
  PAST_DEADLINE_MESSAGE,
  DUPLICATE_TASK_TITLE_MESSAGE,
  ASSIGNEE_NOT_PROJECT_MEMBER_MESSAGE,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  UNASSIGNED,
  type SortKey,
} from './task.constant';
import type { CreateTaskInput, UpdateTaskInput } from './task.validation';
import { recordActivity } from '../activityLog/activityLog.service';
import { enqueue as enqueueNotification } from '../notification/notification.service';
import { fanoutEmailJobs } from '../email/email.enqueue';
import { arrayOrEq } from '../../lib/queryFields';

// Post-commit email fan-out helper shared by every task.* mutation. Resolves
// the actor's display name (so renderEmail can address users by name) and
// hands the recipient set off to the queue producer. The producer fast-paths
// when REDIS_URL is unset, so the only work this does in dev/test is an early
// return on an empty recipient list.
const fanoutTaskEmails = async (params: {
  recipientIds: string[];
  actorId: string | null;
  type: 'task.assigned' | 'task.unassigned' | 'task.status_changed';
  taskTitle: string;
  taskId: string;
  projectId: string;
  status?: string;
  previousStatus?: string;
}): Promise<void> => {
  if (params.recipientIds.length === 0) return;
  let actorName: string | null = null;
  if (params.actorId) {
    const actor = await prisma.user.findUnique({
      where: { id: params.actorId },
      select: { name: true },
    });
    actorName = actor?.name ?? null;
  }
  await fanoutEmailJobs({
    recipientIds: params.recipientIds,
    actorId: params.actorId ?? '',
    actorName,
    type: params.type,
    payload: {
      taskTitle: params.taskTitle,
      taskId: params.taskId,
      projectId: params.projectId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.previousStatus ? { previousStatus: params.previousStatus } : {}),
    },
  });
};

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
  assignees: TaskAssigneeRel[];
};

// ──────────────────────────────────────────────────────────
// Task write permission predicates (task-assignee-write)
// ──────────────────────────────────────────────────────────

type CanWriteArgs = {
  actor: Actor | undefined;
  task: Pick<Task, 'createdBy'> & { assignees: { userId: string }[] };
  projectRole?: 'pm' | 'member' | null; // resolved per-project; null = not a member
};

/**
 * Returns true when the actor may edit task fields (status / title / desc / priority / due).
 * Admin and project PM are always allowed. Any assignee is allowed (multi-assignee).
 * Unassigned tasks (no assignees) cannot be field-edited by anyone except admin / project PM.
 */
export const canWriteTask = ({ actor, task, projectRole }: CanWriteArgs): boolean => {
  if (isAdmin(actor)) return true;
  if (projectRole === 'pm') return true;
  if (!actor) return false;
  return task.assignees.some((a) => a.userId === actor.id);
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
 * Returns true when the actor may reassign the task (add / remove / replace
 * the TaskAssignee set). PM/admin only — assignees cannot reassign out.
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

type PrismaLike = typeof prisma | Prisma.TransactionClient;

const ensureAssigneeIsProjectMember = async (
  projectId: string,
  userId: string | null | undefined,
  client: PrismaLike = prisma,
) => {
  if (!userId) return; // null/undefined always allowed (unassigned)
  const candidate = await client.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!candidate) {
    throw ApiError.unprocessable(ASSIGNEE_NOT_PROJECT_MEMBER_MESSAGE, 'ASSIGNEE_NOT_PROJECT_MEMBER');
  }
  if (candidate.role === Role.admin) return; // system admin bypass — enum-safe vs string drift
  const member = await client.projectMember.findFirst({
    where: { projectId, userId },
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
  const assigneeIds = Array.from(new Set(input.assigneeIds ?? []));
  try {
    const created = await prisma.$transaction(async (tx) => {
      // Re-check membership INSIDE the tx so a member removed between request
      // start and write can't slip through as an orphan TaskAssignee.
      for (const userId of assigneeIds) {
        await ensureAssigneeIsProjectMember(input.projectId, userId, tx);
      }
      const task = await tx.task.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          description: input.description ?? null,
          dueDate: input.dueDate,
          status: input.status,
          priority: input.priority,
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

    // POST-COMMIT email fan-out for the newly-assigned users.
    await fanoutTaskEmails({
      recipientIds: assigneeIds.filter((uid) => uid !== actorId),
      actorId,
      type: 'task.assigned',
      taskTitle: created.title,
      taskId: created.id,
      projectId: created.projectId,
    });
    return created;
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

  if (input.title !== undefined && input.title.toLowerCase() !== current.title.toLowerCase()) {
    await ensureTitleUnique(current.projectId, input.title, id);
  }

  // Detect changed fields up-front so we can decide whether to emit task.updated.
  const fieldChanged =
    (input.title !== undefined && input.title !== current.title) ||
    input.description !== undefined ||
    input.dueDate !== undefined ||
    (input.status !== undefined && input.status !== current.status) ||
    (input.priority !== undefined && input.priority !== current.priority);

  try {
    let statusChangeRecipients: string[] = [];
    const updated = await prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
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
        // Fan-out: notify every assignee except the actor on status change.
        const recipients = task.assignees.map((a) => a.userId).filter((uid) => uid !== actorId);
        for (const recipientId of recipients) {
          await enqueueNotification(tx, {
            recipientId,
            actorId,
            type: 'task.status_changed',
            entityType: 'task',
            entityId: task.id,
            projectId: task.projectId,
            payload: { taskTitle: task.title, taskId: task.id, projectId: task.projectId },
          });
        }
        statusChangeRecipients = recipients;
      }

      return task;
    });

    // POST-COMMIT email fan-out for status-change recipients.
    if (statusChangeRecipients.length > 0) {
      await fanoutTaskEmails({
        recipientIds: statusChangeRecipients,
        actorId,
        type: 'task.status_changed',
        taskTitle: updated.title,
        taskId: updated.id,
        projectId: updated.projectId,
        status: updated.status,
        previousStatus: current.status,
      });
    }
    return updated;
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
 * Filter tasks by assignee. The query-string key is `assignedTo` (kept stable for
 * frontend compat) but resolves to a `TaskAssignee` join check; the legacy
 * single-FK column is gone (#B7).
 */
const buildAssignedToWhere = (
  v: ListArgs['assignedTo'],
  actorId: string | undefined,
): Prisma.TaskWhereInput | Record<string, never> => {
  if (!v) return {};
  if (v === UNASSIGNED) return { assignees: { none: {} } };
  if (v === 'me') return actorId ? { assignees: { some: { userId: actorId } } } : {};
  return { assignees: { some: { userId: v } } };
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

const addAssignee = async (
  taskId: string,
  userId: string,
  actorId: string,
  actor?: Actor,
): Promise<TaskWithRelations> => {
  const existing = await loadTaskForAssigneeOp(taskId);
  await ensureCanReassign(actor, existing.projectId);
  const result = await prisma.$transaction(async (tx) => {
    await ensureAssigneeIsProjectMember(existing.projectId, userId, tx);
    await tx.taskAssignee.upsert({
      where: { taskId_userId: { taskId, userId } },
      create: { taskId, userId, addedById: actorId },
      update: {}, // idempotent: re-adding existing assignee is a no-op
    });
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
  await fanoutTaskEmails({
    recipientIds: userId !== actorId ? [userId] : [],
    actorId,
    type: 'task.assigned',
    taskTitle: existing.title,
    taskId,
    projectId: existing.projectId,
  });
  return result;
};

const removeAssignee = async (
  taskId: string,
  userId: string,
  actorId: string,
  actor?: Actor,
): Promise<TaskWithRelations> => {
  const existing = await loadTaskForAssigneeOp(taskId);
  await ensureCanReassign(actor, existing.projectId);
  const result = await prisma.$transaction(async (tx) => {
    await tx.taskAssignee
      .delete({ where: { taskId_userId: { taskId, userId } } })
      .catch((err) => {
        if (isRecordNotFound(err)) return; // idempotent: removing non-assignee = no-op
        throw err;
      });
    await recordActivity(tx, {
      actorId,
      action: 'task.unassigned',
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
  await fanoutTaskEmails({
    recipientIds: userId !== actorId ? [userId] : [],
    actorId,
    type: 'task.unassigned',
    taskTitle: existing.title,
    taskId,
    projectId: existing.projectId,
  });
  return result;
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
  const current = new Set(existing.assignees.map((a) => a.userId));
  const nextSet = new Set(next);
  const toAdd = next.filter((id) => !current.has(id));
  const toRemove = Array.from(current).filter((id) => !nextSet.has(id));
  const result = await prisma.$transaction(async (tx) => {
    // Atomic membership validation INSIDE tx — partial apply not allowed, and
    // we close the TOCTOU window between membership check and TaskAssignee write.
    for (const id of next) {
      await ensureAssigneeIsProjectMember(existing.projectId, id, tx);
    }
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

  // POST-COMMIT fan-out for both sides of the assignee delta.
  await fanoutTaskEmails({
    recipientIds: toAdd.filter((uid) => uid !== actorId),
    actorId,
    type: 'task.assigned',
    taskTitle: existing.title,
    taskId,
    projectId: existing.projectId,
  });
  await fanoutTaskEmails({
    recipientIds: toRemove.filter((uid) => uid !== actorId),
    actorId,
    type: 'task.unassigned',
    taskTitle: existing.title,
    taskId,
    projectId: existing.projectId,
  });
  return result;
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
