// Standalone BullMQ worker process. Run separately from the HTTP server:
//
//   node dist/src/worker.js          (production)
//   npm --prefix backend run worker  (dev, via tsx watch)
//
// Wires up:
//   - email queue → email processor
//
// The processor itself lives in ./app/modules/email/email.processor.ts (T007);
// this entrypoint only handles process lifecycle so we can swap processors
// without rebuilding the runner.

import 'dotenv/config';
import { Worker, type Processor } from 'bullmq';
import {
  EMAIL_QUEUE_NAME,
  getRedisConnection,
  resetEmailQueueCache,
  type EmailJobData,
} from './app/modules/email/email.queue';

const log = (msg: string, extra?: Record<string, unknown>): void => {
  const line = extra ? `${msg} ${JSON.stringify(extra)}` : msg;
  // eslint-disable-next-line no-console
  console.log(`[worker] ${line}`);
};

// Lazy-import the processor so that running `worker.ts` without the email
// module installed still gives a clear error rather than a crash on import.
const loadEmailProcessor = async (): Promise<Processor<EmailJobData>> => {
  try {
    // Path is built at runtime so TS doesn't try to resolve a module that
    // only lands in T007. Dynamic import lets the worker boot before then.
    const path = './app/modules/email/email.processor';
    const mod = (await import(path)) as { emailProcessor: Processor<EmailJobData> };
    return mod.emailProcessor;
  } catch {
    log('email processor not yet implemented (T007 will land it)');
    // Stub processor so the worker boots cleanly during dev before T007.
    return async (job) => {
      log('email job received (no-op processor)', {
        id: job.id,
        name: job.name,
        recipientId: job.data.recipientId,
      });
    };
  }
};

// Recipient PII (email address) is never logged from the worker. Job id is
// enough to correlate against BullMQ events; the recipient address lives in
// the job payload (Redis) for the brief retention window only.

const start = async (): Promise<void> => {
  log('starting');
  const processor = await loadEmailProcessor();
  const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processor, {
    connection: getRedisConnection(),
    concurrency: Number(process.env.EMAIL_WORKER_CONCURRENCY ?? '5'),
  });

  worker.on('completed', (job) => {
    log('job completed', { id: job.id, name: job.name, recipientId: job.data.recipientId });
  });
  worker.on('failed', (job, err) => {
    log('job failed', {
      id: job?.id,
      name: job?.name,
      recipientId: job?.data.recipientId,
      attempt: job?.attemptsMade,
      err: err.message,
    });
  });

  const shutdown = async (signal: string): Promise<void> => {
    log(`received ${signal}, draining`);
    try {
      await worker.close();
      await resetEmailQueueCache();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  log('ready');
};

void start();
