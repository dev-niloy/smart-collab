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
import { enqueue as enqueueNotification } from '../notification/notification.service';
import { fanoutEmailJobs } from '../email/email.enqueue';
import type { EmailJobData, EmailJobName, ProjectMemberEntry } from '../email/email.queue';

// Post-commit context fetch for project.member_* emails. Pulled in a single
// query so the request path stays fast and the worker never has to round-trip
// back to Prisma for the team list / description / deadline.
const buildProjectMemberEmailContext = async (
  projectId: string,
  actorId: string | null,
): Promise<{
  projectName: string | undefined;
  projectDescription: string | null | undefined;
  projectDeadline: string | undefined;
  projectMembers: ProjectMemberEntry[];
  projectMemberCount: number;
  actorName: string | null;
}> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      description: true,
      deadline: true,
      members: {
        select: {
          role: true,
          user: { select: { id: true, name: true } },
        },
        orderBy: { user: { name: 'asc' } },
      },
    },
  });
  if (!project) {
    return {
      projectName: undefined,
      projectDescription: undefined,
      projectDeadline: undefined,
      projectMembers: [],
      projectMemberCount: 0,
      actorName: null,
    };
  }
  const members: ProjectMemberEntry[] = project.members.map((m) => ({
    name: m.user.name,
    role: m.role,
  }));
  const actor = actorId
    ? project.members.find((m) => m.user.id === actorId)?.user.name ??
      (await prisma.user
        .findUnique({ where: { id: actorId }, select: { name: true } })
        .then((u) => u?.name ?? null))
    : null;
  return {
    projectName: project.name,
    projectDescription: project.description,
    projectDeadline: project.deadline.toISOString(),
    projectMembers: members,
    projectMemberCount: members.length,
    actorName: actor ?? null,
  };
};

// Shared producer used by addMember + updateRole (T006). Wraps the context
// fetch + fanoutEmailJobs call so each caller stays a one-liner.
const fanoutProjectMemberEmails = async (params: {
  projectId: string;
  recipientId: string;
  actorId: string;
  type: Extract<EmailJobName, 'project.member_added' | 'project.member_role_changed'>;
  extraPayload?: Partial<EmailJobData['payload']>;
}): Promise<void> => {
  // Self-action short circuit — fan-out already drops the actor, but skipping
  // the DB roundtrip here keeps the request path cheap when a PM adds
  // themselves to a project they created.
  if (params.recipientId === params.actorId) return;
  const ctx = await buildProjectMemberEmailContext(params.projectId, params.actorId);
  await fanoutEmailJobs({
    recipientIds: [params.recipientId],
    actorId: params.actorId,
    actorName: ctx.actorName,
    type: params.type,
    payload: {
      projectId: params.projectId,
      projectName: ctx.projectName,
      projectDescription: ctx.projectDescription ?? undefined,
      projectDeadline: ctx.projectDeadline,
      projectMembers: ctx.projectMembers,
      projectMemberCount: ctx.projectMemberCount,
      ...(params.extraPayload ?? {}),
    },
  });
};

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
    const created = await prisma.$transaction(async (tx) => {
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
      // In-app notification inside the tx so a rolled-back create never
      // leaves an orphan notification row. Self-add is skipped by the
      // notification.service.enqueue contract (actorId === recipientId
      // returns null).
      await enqueueNotification(tx, {
        recipientId: user.id,
        actorId,
        type: 'project.member_added',
        entityType: 'member',
        entityId: member.id,
        projectId,
        payload: {
          projectName: undefined,
          memberId: member.id,
          newRole: member.role,
        },
      });
      return member;
    });

    // POST-COMMIT email fan-out. Self-add + opt-out are guarded downstream.
    await fanoutProjectMemberEmails({
      projectId,
      recipientId: user.id,
      actorId,
      type: 'project.member_added',
      extraPayload: { memberId: created.id, newRole: created.role },
    });
    return created;
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
  // per assignee. A task with N assignees contributes +1 to each assignee's
  // workload.
  const userSet = new Set(userIds);
  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      deletedAt: null,
      assignees: { some: { userId: { in: userIds } } },
    },
    select: {
      id: true,
      status: true,
      dueDate: true,
      assignees: { select: { userId: true } },
    },
  });
  for (const t of tasks) {
    for (const a of t.assignees) {
      if (!userSet.has(a.userId)) continue;
      const w = map.get(a.userId)!;
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

    // Multi-assignee: drop TaskAssignee rows for this user scoped to this project.
    const joinDeleted = await tx.taskAssignee.deleteMany({
      where: { userId: target.userId, task: { projectId } },
    });
    const tasksUnassigned = joinDeleted.count;

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
