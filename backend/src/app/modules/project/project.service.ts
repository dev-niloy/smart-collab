import type { Project, ProjectStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import { PAST_DEADLINE_MESSAGE, DEFAULT_LIMIT, DEFAULT_PAGE, type SortKey } from './project.constant';
import type { CreateProjectInput, UpdateProjectInput } from './project.validation';
import { recordActivity } from '../activityLog/activityLog.service';

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
    return project;
  });
};

const findById = async (id: string): Promise<ProjectWithCreator> => {
  const p = await prisma.project.findUnique({ where: { id }, include: creatorInclude });
  if (!p) throw ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND');
  return p;
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
      return project;
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

const arrayOrEq = <T>(v: T | T[] | undefined): T | { in: T[] } | undefined => {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v.length === 0 ? undefined : { in: v };
  return v;
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
  const where: Prisma.ProjectWhereInput = {
    ...(args.q ? { name: { contains: args.q, mode: 'insensitive' } } : {}),
    ...(statusFilter !== undefined ? { status: statusFilter } : {}),
    ...(deadline ? { deadline } : {}),
    ...(createdByResolved ? { createdBy: createdByResolved } : {}),
  };
  const [data, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      orderBy: sortToOrderBy(args.sort),
      skip: (page - 1) * limit,
      take: limit,
      include: creatorInclude,
    }),
    prisma.project.count({ where }),
  ]);
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
