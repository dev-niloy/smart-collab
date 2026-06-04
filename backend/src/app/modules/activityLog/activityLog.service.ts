import type { Prisma, ActivityLog } from '@prisma/client';
import { isKnownAction, sanitizeMeta, type ActivityAction, type EntityType } from './activityLog.constant';

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
