import type { Prisma, Notification } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import {
  isKnownNotificationType,
  sanitizeNotificationPayload,
  type NotificationType,
} from './notification.constant';

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
  return tx.notification.create({
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

// Exported for routes/controller use later (t11)
export const notificationService = {
  enqueue,
  enqueueMany,
  _prisma: prisma,
};
