import type { ProjectMember, ProjectRole } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import {
  ERR_USER_NOT_FOUND,
  USER_NOT_FOUND_MESSAGE,
  ERR_ALREADY_MEMBER,
  ALREADY_MEMBER_MESSAGE,
} from './projectMember.constant';

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
    return await prisma.projectMember.create({
      data: { projectId, userId: user.id, role, addedById: actorId },
      include: memberInclude,
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

export const projectMemberService = {
  addMember,
  isMember,
  getProjectRole,
  listAssignable,
  // exposed for tests + future tasks
  _findUserByEmail: findUserByEmail,
  _ensureProjectExists: ensureProjectExists,
};
