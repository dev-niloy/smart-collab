import type { Prisma, Notification } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import { decodeCursor, encodeCursor } from '../activityLog/activityLog.validation';
import {
  isKnownNotificationType,
  sanitizeNotificationPayload,
  type NotificationType,
} from './notification.constant';
import { publishNotificationCreated } from './notification.sse';

export type EnqueueInput = {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType | string;
  entityType: string;
  entityId: string;
  projectId?: string | null;
  payload?: Record<string, unknown> | null;
};

const validateInput = (input: EnqueueInput): void => {
  if (!isKnownNotificationType(input.type)) {
    throw ApiError.internal(`unknown notification type: ${input.type}`, 'UNKNOWN_NOTIFICATION_TYPE');
  }
};

export const enqueue = async (
  tx: Prisma.TransactionClient,
  input: EnqueueInput,
): Promise<Notification | null> => {
  validateInput(input);
  if (input.actorId && input.actorId === input.recipientId) {
    // Never notify the actor about their own action.
    return null;
  }
  const payload = sanitizeNotificationPayload(input.payload ?? null);
  const row = await tx.notification.create({
    data: {
      recipientId: input.recipientId,
      actorId: input.actorId ?? null,
      type: input.type,
      entityType: input.entityType,
      entityId: input.entityId,
      projectId: input.projectId ?? null,
      ...(payload ? { payload: payload as Prisma.InputJsonValue } : {}),
    },
  });
  // Live push to any open SSE channel. See notification.sse for the
  // documented rollback trade-off.
  publishNotificationCreated(row.recipientId, {
    id: row.id,
    type: row.type,
    actorId: row.actorId,
    entityType: row.entityType,
    entityId: row.entityId,
    projectId: row.projectId,
    payload: (row.payload as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  });
  return row;
};

export const enqueueMany = async (
  tx: Prisma.TransactionClient,
  inputs: EnqueueInput[],
): Promise<Notification[]> => {
  const seen = new Set<string>();
  const out: Notification[] = [];
  for (const i of inputs) {
    if (!i.recipientId) continue;
    if (seen.has(i.recipientId)) continue;
    seen.add(i.recipientId);
    const row = await enqueue(tx, i);
    if (row) out.push(row);
  }
  return out;
};

export type NotificationDTO = {
  id: string;
  type: string;
  actorId: string | null;
  actorName: string | null;
  entityType: string;
  entityId: string;
  projectId: string | null;
  payload: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
};

export type NotificationListPage = {
  items: NotificationDTO[];
  nextCursor: string | null;
};

type WithActor = Notification & { actor: { name: string } | null };

const toDTO = (row: WithActor): NotificationDTO => ({
  id: row.id,
  type: row.type,
  actorId: row.actorId,
  actorName: row.actor?.name ?? null,
  entityType: row.entityType,
  entityId: row.entityId,
  projectId: row.projectId,
  payload: (row.payload as Record<string, unknown> | null) ?? null,
  readAt: row.readAt,
  createdAt: row.createdAt,
});

const buildCursorWhere = (cursor?: string): Prisma.NotificationWhereInput | undefined => {
  if (!cursor) return undefined;
  const { createdAt, id } = decodeCursor(cursor);
  return {
    OR: [
      { createdAt: { lt: createdAt } },
      { createdAt, id: { lt: id } },
    ],
  };
};

const listForUser = async (
  userId: string,
  args: { limit: number; cursor?: string; unread?: boolean },
): Promise<NotificationListPage> => {
  const where: Prisma.NotificationWhereInput = {
    recipientId: userId,
    ...(args.unread ? { readAt: null } : {}),
    ...(buildCursorWhere(args.cursor) ?? {}),
  };
  const rows = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: args.limit + 1,
    include: { actor: { select: { name: true } } },
  });
  let nextCursor: string | null = null;
  if (rows.length > args.limit) {
    const last = rows[args.limit - 1];
    nextCursor = encodeCursor({ createdAt: last.createdAt, id: last.id });
    rows.length = args.limit;
  }
  return { items: rows.map(toDTO), nextCursor };
};

const countUnread = async (userId: string): Promise<number> => {
  return prisma.notification.count({ where: { recipientId: userId, readAt: null } });
};

const markRead = async (id: string, userId: string): Promise<NotificationDTO> => {
  // Filter by ownership in the same query so we never even fetch someone
  // else's row (defence in depth) and short-circuit the already-read case.
  const existing = await prisma.notification.findFirst({
    where: { id, recipientId: userId },
    include: { actor: { select: { name: true } } },
  });
  if (!existing) {
    throw ApiError.notFound('Notification not found', 'NOTIFICATION_NOT_FOUND');
  }
  if (existing.readAt) return toDTO(existing);
  const updated = await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
    include: { actor: { select: { name: true } } },
  });
  return toDTO(updated);
};

const markAllRead = async (userId: string): Promise<{ updated: number }> => {
  const res = await prisma.notification.updateMany({
    where: { recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: res.count };
};

export const notificationService = {
  enqueue,
  enqueueMany,
  listForUser,
  countUnread,
  markRead,
  markAllRead,
};
