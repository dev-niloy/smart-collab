import type { Prisma, ActivityLog } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { isKnownAction, sanitizeMeta, type ActivityAction, type EntityType } from './activityLog.constant';
import { decodeCursor, encodeCursor } from './activityLog.validation';

export type RecordActivityInput = {
  actorId: string | null;
  action: ActivityAction | string;
  entityType: EntityType | string;
  entityId: string;
  projectId?: string | null;
  meta?: Record<string, unknown> | null;
};

export async function recordActivity(
  tx: Prisma.TransactionClient,
  input: RecordActivityInput,
): Promise<ActivityLog> {
  if (!isKnownAction(input.action)) {
    throw new Error(`unknown activity action: ${input.action}`);
  }
  const meta = sanitizeMeta(input.meta);
  return tx.activityLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      projectId: input.projectId ?? null,
      ...(meta ? { meta: meta as Prisma.InputJsonValue } : {}),
    },
  });
}

export type ActivityDTO = {
  id: string;
  action: string;
  actorId: string | null;
  actorName: string | null;
  entityType: string;
  entityId: string;
  projectId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: Date;
};

export type ListPage = {
  items: ActivityDTO[];
  nextCursor: string | null;
};

type ListArgs = {
  limit?: number;
  cursor?: string;
};

const toDTO = (row: ActivityLog & { actor: { name: string } | null }): ActivityDTO => ({
  id: row.id,
  action: row.action,
  actorId: row.actorId,
  actorName: row.actor?.name ?? null,
  entityType: row.entityType,
  entityId: row.entityId,
  projectId: row.projectId,
  meta: (row.meta as Record<string, unknown> | null) ?? null,
  createdAt: row.createdAt,
});

const buildCursorWhere = (cursor?: string): Prisma.ActivityLogWhereInput | undefined => {
  if (!cursor) return undefined;
  const { createdAt, id } = decodeCursor(cursor);
  return {
    OR: [
      { createdAt: { lt: createdAt } },
      { createdAt, id: { lt: id } },
    ],
  };
};

const runList = async (
  where: Prisma.ActivityLogWhereInput,
  limit: number,
): Promise<ListPage> => {
  const rows = await prisma.activityLog.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    include: { actor: { select: { name: true } } },
  });
  let nextCursor: string | null = null;
  if (rows.length > limit) {
    const last = rows[limit - 1];
    nextCursor = encodeCursor({ createdAt: last.createdAt, id: last.id });
    rows.length = limit;
  }
  return { items: rows.map(toDTO), nextCursor };
};

export const listGlobal = async (args: ListArgs = {}): Promise<ListPage> => {
  const limit = args.limit ?? 10;
  const where: Prisma.ActivityLogWhereInput = buildCursorWhere(args.cursor) ?? {};
  return runList(where, limit);
};

export const listByProject = async (
  projectId: string,
  args: ListArgs = {},
): Promise<ListPage> => {
  const limit = args.limit ?? 10;
  const cursorWhere = buildCursorWhere(args.cursor);
  const where: Prisma.ActivityLogWhereInput = {
    projectId,
    ...(cursorWhere ?? {}),
  };
  return runList(where, limit);
};
