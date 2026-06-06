import type { ProjectMember, ProjectRole } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import {
  ERR_USER_NOT_FOUND,
  USER_NOT_FOUND_MESSAGE,
  ERR_ALREADY_MEMBER,
  ALREADY_MEMBER_MESSAGE,
  ERR_MEMBER_NOT_FOUND,
  MEMBER_NOT_FOUND_MESSAGE,
  ERR_CANNOT_REMOVE_LAST_PM,
  CANNOT_REMOVE_LAST_PM_MESSAGE,
} from './projectMember.constant';
import { recordActivity } from '../activityLog/activityLog.service';

const userSelect = { id: true, email: true, name: true, role: true } as const;

const memberInclude = {
  user: { select: userSelect },
} as const;

export type MemberWithUser = ProjectMember & {
  user: { id: string; email: string; name: string; role: string };
};

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002';

const findUserByEmail = async (email: string) =>
  prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, role: true },
  });

const ensureProjectExists = async (projectId: string) => {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!p) throw ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND');
};

const addMember = async (
  projectId: string,
  email: string,
  role: ProjectRole,
  actorId: string,
): Promise<MemberWithUser> => {
  await ensureProjectExists(projectId);
  const user = await findUserByEmail(email);
  if (!user) throw ApiError.notFound(USER_NOT_FOUND_MESSAGE, ERR_USER_NOT_FOUND);
  try {
    return await prisma.$transaction(async (tx) => {
      const member = await tx.projectMember.create({
        data: { projectId, userId: user.id, role, addedById: actorId },
        include: memberInclude,
      });
      await recordActivity(tx, {
        actorId,
        action: 'member.added',
        entityType: 'member',
        entityId: member.id,
        projectId,
        meta: { userId: user.id, role: member.role, name: user.name },
      });
      return member;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw ApiError.unprocessable(ALREADY_MEMBER_MESSAGE, ERR_ALREADY_MEMBER);
    }
    throw err;
  }
};

const isMember = async (projectId: string, userId: string): Promise<boolean> => {
  const row = await prisma.projectMember.findUnique({
    where: { project_members_project_user_unique: { projectId, userId } },
    select: { id: true },
  });
  return row !== null;
};

const getProjectRole = async (
  projectId: string,
  userId: string,
): Promise<ProjectRole | null> => {
  const row = await prisma.projectMember.findUnique({
    where: { project_members_project_user_unique: { projectId, userId } },
    select: { role: true },
  });
  return row?.role ?? null;
};

type AssignableEntry = {
  id: string;
  email: string;
  name: string;
  role: string;
  projectRole: ProjectRole | 'admin';
};

const listAssignable = async (projectId: string): Promise<AssignableEntry[]> => {
  await ensureProjectExists(projectId);
  const [members, admins] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId },
      include: memberInclude,
      orderBy: { user: { name: 'asc' } },
    }),
    prisma.user.findMany({
      where: { role: 'admin' },
      select: userSelect,
      orderBy: { name: 'asc' },
    }),
  ]);
  const seen = new Set<string>();
  const out: AssignableEntry[] = [];
  for (const m of members) {
    if (seen.has(m.user.id)) continue;
    seen.add(m.user.id);
    out.push({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      role: m.user.role,
      projectRole: m.role,
    });
  }
  for (const a of admins) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push({ ...a, projectRole: 'admin' });
  }
  return out;
};

export type Workload = {
  todo: number;
  in_progress: number;
  completed: number;
  due_soon: number;
};

export type MemberRow = MemberWithUser & { workload: Workload };

// Build a {userId -> Workload} map for all members of a project in a fixed
// number of queries (2), instead of N+1 (members × 4 counts).
const buildWorkloadMap = async (
  projectId: string,
  userIds: string[],
): Promise<Map<string, Workload>> => {
  const map = new Map<string, Workload>();
  for (const id of userIds) {
    map.set(id, { todo: 0, in_progress: 0, completed: 0, due_soon: 0 });
  }
  if (userIds.length === 0) return map;
  const horizon = new Date(Date.now() + 7 * 86_400_000);
  const now = new Date();

  // Multi-assignee: pull every task the userIds are attached to and attribute +1
  // per assignee. Dual-reads TaskAssignee + legacy assignedTo during transition;
  // a Set per user prevents double-count when both are populated for the same task.
  const userSet = new Set(userIds);
  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      deletedAt: null,
      OR: [
        { assignedTo: { in: userIds } },
        { assignees: { some: { userId: { in: userIds } } } },
      ],
    },
    select: {
      id: true,
      status: true,
      dueDate: true,
      assignedTo: true,
      assignees: { select: { userId: true } },
    },
  });
  const seen = new Map<string, Set<string>>(); // userId → Set<taskId>
  for (const uid of userIds) seen.set(uid, new Set());
  for (const t of tasks) {
    const linked = new Set<string>();
    if (t.assignedTo && userSet.has(t.assignedTo)) linked.add(t.assignedTo);
    for (const a of t.assignees) if (userSet.has(a.userId)) linked.add(a.userId);
    for (const uid of linked) {
      const seenSet = seen.get(uid)!;
      if (seenSet.has(t.id)) continue;
      seenSet.add(t.id);
      const w = map.get(uid)!;
      if (t.status === 'todo') w.todo += 1;
      else if (t.status === 'in_progress') w.in_progress += 1;
      else if (t.status === 'completed') w.completed += 1;
      if (
        t.status !== 'completed' &&
        t.dueDate.getTime() >= now.getTime() &&
        t.dueDate.getTime() <= horizon.getTime()
      ) {
        w.due_soon += 1;
      }
    }
  }
  return map;
};

const listMembers = async (projectId: string): Promise<MemberRow[]> => {
  await ensureProjectExists(projectId);
  const rows = await prisma.projectMember.findMany({
    where: { projectId },
    include: memberInclude,
    orderBy: { user: { name: 'asc' } },
  });
  const userIds = rows.map((r) => r.userId);
  const wlMap = await buildWorkloadMap(projectId, userIds);
  return rows.map((r) => ({
    ...r,
    workload: wlMap.get(r.userId) ?? { todo: 0, in_progress: 0, completed: 0, due_soon: 0 },
  }));
};

const updateRole = async (
  projectId: string,
  memberId: string,
  role: ProjectRole,
): Promise<MemberWithUser> => {
  try {
    return await prisma.projectMember.update({
      where: { id: memberId, projectId },
      data: { role },
      include: memberInclude,
    });
  } catch (err) {
    if (isRecordNotFound(err)) {
      throw ApiError.notFound(MEMBER_NOT_FOUND_MESSAGE, ERR_MEMBER_NOT_FOUND);
    }
    throw err;
  }
};

const isRecordNotFound = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2025';

type RemoveResult = { removedMemberId: string; tasksUnassigned: number };

const removeMember = async (
  projectId: string,
  memberId: string,
  actorId: string | null = null,
): Promise<RemoveResult> => {
  return prisma.$transaction(async (tx) => {
    const target = await tx.projectMember.findUnique({
      where: { id: memberId },
      select: { id: true, projectId: true, userId: true, role: true },
    });
    if (!target || target.projectId !== projectId) {
      throw ApiError.notFound(MEMBER_NOT_FOUND_MESSAGE, ERR_MEMBER_NOT_FOUND);
    }

    if (target.role === 'pm') {
      const [pmCount, taskCount] = await Promise.all([
        tx.projectMember.count({ where: { projectId, role: 'pm' } }),
        tx.task.count({ where: { projectId } }),
      ]);
      if (pmCount === 1 && taskCount > 0) {
        throw ApiError.unprocessable(
          CANNOT_REMOVE_LAST_PM_MESSAGE,
          ERR_CANNOT_REMOVE_LAST_PM,
        );
      }
    }

    const legacyUnassigned = await tx.task.updateMany({
      where: { projectId, assignedTo: target.userId },
      data: { assignedTo: null },
    });

    // Multi-assignee: drop TaskAssignee rows for this user scoped to this project.
    const joinDeleted = await tx.taskAssignee.deleteMany({
      where: { userId: target.userId, task: { projectId } },
    });

    // Report the higher count — covers both transition states (legacy-only rows
    // and migrated rows). They overlap for dual-write tasks, so taking the max
    // approximates the unique-task count rather than double-counting.
    const tasksUnassigned = Math.max(legacyUnassigned.count, joinDeleted.count);

    await recordActivity(tx, {
      actorId,
      action: 'member.removed',
      entityType: 'member',
      entityId: target.id,
      projectId,
      meta: { userId: target.userId, role: target.role },
    });

    await tx.projectMember.delete({ where: { id: memberId } });

    return { removedMemberId: memberId, tasksUnassigned };
  });
};

export const projectMemberService = {
  addMember,
  isMember,
  getProjectRole,
  listAssignable,
  listMembers,
  updateRole,
  removeMember,
  // exposed for tests + future tasks
  _findUserByEmail: findUserByEmail,
  _ensureProjectExists: ensureProjectExists,
};
