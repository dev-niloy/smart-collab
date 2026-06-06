// Producer-side fan-out: turn a single domain event (e.g. "comment.created on
// task X") into one BullMQ job per recipient. Looks up each recipient's email
// + name + opt-out flag in a single batched query so callers don't need to
// touch Prisma themselves.
//
// Callers must invoke this AFTER their Prisma transaction commits. Pulling
// fan-out outside the tx keeps the request path fast (no extra round-trips
// inside the lock) and makes sure we never enqueue mail for rolled-back state.

import { prisma as defaultPrisma } from '../../../config/prisma';
import { enqueueEmailJob, type EmailJobData, type EmailJobName } from './email.queue';

type PrismaLike = typeof defaultPrisma;
type EnqueueFn = typeof enqueueEmailJob;

export type EmailFanoutInput = {
  recipientIds: string[];
  actorId: string;
  actorName: string | null;
  type: EmailJobName;
  payload: EmailJobData['payload'];
};

export type FanoutDeps = {
  prisma?: PrismaLike;
  enqueue?: EnqueueFn;
};

export type FanoutResult = {
  considered: number;
  enqueued: number;
};

export const fanoutEmailJobs = async (
  input: EmailFanoutInput,
  deps: FanoutDeps = {},
): Promise<FanoutResult> => {
  const prisma = deps.prisma ?? defaultPrisma;
  const enqueue = deps.enqueue ?? enqueueEmailJob;

  // Strip the actor; never mail someone about their own action.
  const recipients = input.recipientIds.filter(
    (id) => id && id !== input.actorId,
  );
  if (recipients.length === 0) return { considered: 0, enqueued: 0 };

  // Fast-path: if the real enqueuer would no-op (no REDIS_URL), skip the DB
  // round-trip entirely. Tests inject a stub enqueue and bypass this gate.
  if (enqueue === enqueueEmailJob && !process.env.REDIS_URL) {
    return { considered: recipients.length, enqueued: 0 };
  }

  // Single batched lookup. Filter to opt-in users here as an optimization; the
  // processor still re-checks at send time so a race between this read and
  // the user flipping the toggle never produces a missed opt-out.
  const users = await prisma.user.findMany({
    where: { id: { in: recipients }, emailNotifications: true },
    select: { id: true, email: true, name: true },
  });

  let enqueued = 0;
  for (const u of users) {
    await enqueue({
      name: input.type,
      data: {
        recipientId: u.id,
        recipientEmail: u.email,
        recipientName: u.name,
        actorName: input.actorName,
        type: input.type,
        payload: input.payload,
      },
    });
    enqueued += 1;
  }
  return { considered: recipients.length, enqueued };
};
