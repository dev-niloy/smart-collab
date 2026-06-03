import type { Project, ProjectStatus, Prisma } from '@prisma/client';
import { Prisma as PrismaNS } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import { PAST_DEADLINE_MESSAGE, DEFAULT_LIMIT, DEFAULT_PAGE, type SortKey } from './project.constant';
import type { CreateProjectInput, UpdateProjectInput } from './project.validation';

const ensureFutureDeadline = (deadline: Date) => {
  if (deadline.getTime() < Date.now()) {
    throw ApiError.unprocessable(PAST_DEADLINE_MESSAGE, 'PAST_DEADLINE');
  }
};

const create = async (input: CreateProjectInput, actorId: string): Promise<Project> => {
  ensureFutureDeadline(input.deadline);
  return prisma.project.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      deadline: input.deadline,
      status: input.status,
      createdBy: actorId,
    },
  });
};

const findById = async (id: string): Promise<Project> => {
  const p = await prisma.project.findUnique({ where: { id } });
  if (!p) throw ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND');
  return p;
};

const update = async (id: string, input: UpdateProjectInput): Promise<Project> => {
  if (input.deadline) ensureFutureDeadline(input.deadline);
  try {
    return await prisma.project.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
  } catch (err) {
    if (err instanceof PrismaNS.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND');
    }
    throw err;
  }
};

const remove = async (id: string): Promise<void> => {
  try {
    await prisma.project.delete({ where: { id } });
  } catch (err) {
    if (err instanceof PrismaNS.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw ApiError.notFound('Project not found', 'PROJECT_NOT_FOUND');
    }
    throw err;
  }
};

type ListArgs = {
  q?: string;
  status?: ProjectStatus;
  sort: SortKey;
  page: number;
  limit: number;
};

type ListResult = {
  data: Project[];
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
  const where: Prisma.ProjectWhereInput = {
    ...(args.q ? { name: { contains: args.q, mode: 'insensitive' } } : {}),
    ...(args.status ? { status: args.status } : {}),
  };
  const [data, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      orderBy: sortToOrderBy(args.sort),
      skip: (page - 1) * limit,
      take: limit,
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
