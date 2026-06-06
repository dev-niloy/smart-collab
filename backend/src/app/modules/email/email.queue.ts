// BullMQ wiring for async email delivery.
//
// The queue is lazily constructed so that:
//   - importing this module never opens a Redis connection
//   - tests + envs without REDIS_URL can boot the app without failing
//   - the worker process is the only thing that meaningfully drains the queue
//
// Callers should always go through `enqueueEmailJob()`; direct queue access
// is reserved for the worker entrypoint.

import { Queue, type JobsOptions } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';

export const EMAIL_QUEUE_NAME = 'email';

export type EmailJobName =
  | 'task.assigned'
  | 'task.unassigned'
  | 'task.status_changed'
  | 'comment.created'
  | 'comment.mention';

export type EmailJobData = {
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  actorName: string | null;
  type: EmailJobName;
  // Pre-rendered context — the processor only formats, never re-queries the DB
  // for things the producer already had in hand. Keeps the worker decoupled
  // from request-time auth + project membership context.
  payload: {
    taskTitle?: string;
    taskId?: string;
    projectId?: string;
    projectName?: string;
    commentExcerpt?: string;
    commentId?: string;
    status?: string;
    previousStatus?: string;
  };
};

const defaultJobOpts: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1_000 },
  removeOnComplete: { age: 86_400, count: 1_000 },
  removeOnFail: { age: 604_800 },
};

let cachedConnection: Redis | undefined;
let cachedQueue: Queue<EmailJobData> | undefined;

const getRedisUrl = (): string => {
  const url = process.env.REDIS_URL;
  if (!url || !url.trim()) {
    throw new Error('REDIS_URL is required to use the email queue');
  }
  return url;
};

export const getRedisConnection = (): Redis => {
  if (!cachedConnection) {
    cachedConnection = new IORedis(getRedisUrl(), {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return cachedConnection;
};

export const getEmailQueue = (): Queue<EmailJobData> => {
  if (!cachedQueue) {
    cachedQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: defaultJobOpts,
    });
  }
  return cachedQueue;
};

let warnedMissingRedis = false;

// Producer surface. Callers (comment.service, task.service) invoke this AFTER
// their Prisma transaction commits so we never enqueue mail for rolled-back
// state changes. The processor is responsible for opt-out + template + send.
//
// Fail-open by design (likely_misfire #4): a Redis hiccup must not break the
// API path that produced the notification. Trade-off: a misconfigured prod
// drops mail silently — so we warn LOUDLY (once per process) when REDIS_URL is
// missing and log every enqueue failure with full context for ops alerting.
export const enqueueEmailJob = async (
  job: { name: EmailJobName } & { data: EmailJobData },
): Promise<void> => {
  if (!process.env.REDIS_URL) {
    if (!warnedMissingRedis) {
      warnedMissingRedis = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[email-queue] REDIS_URL not set — email jobs will be silently dropped. ' +
          'This is fine in dev/test, FATAL in prod. Configure REDIS_URL to enable email delivery.',
      );
    }
    return;
  }
  try {
    await getEmailQueue().add(job.name, job.data);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email-queue] enqueue failed', {
      jobName: job.name,
      recipientId: job.data.recipientId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
};

export const resetEmailQueueCache = async (): Promise<void> => {
  if (cachedQueue) {
    await cachedQueue.close();
    cachedQueue = undefined;
  }
  if (cachedConnection) {
    cachedConnection.disconnect();
    cachedConnection = undefined;
  }
};
