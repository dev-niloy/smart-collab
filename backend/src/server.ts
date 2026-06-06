import 'dotenv/config';
import { env } from './config/env';

// Fail fast if env is missing/invalid. Better to crash here than at first request.
let envValues;
try {
  envValues = env();
} catch (err) {
  console.error('[backend] invalid environment:\n' + (err as Error).message);
  process.exit(1);
}

import app from './app';
import { startEmailWorker, type EmailWorkerHandle } from './worker';

const port = envValues.PORT;

const server = app.listen(port, () => {
  console.warn(`[backend] listening on http://localhost:${port}`);
});

// Inline email worker for environments where a separate worker process is
// not viable (e.g. Render free tier blocks background workers). Gated on
// EMAIL_WORKER_INLINE so dev + paid-tier deploys can keep them split.
// Skipped when REDIS_URL is unset (queue is a no-op anyway).
let emailWorker: EmailWorkerHandle | null = null;
const shouldRunInlineWorker =
  process.env.EMAIL_WORKER_INLINE === 'true' && !!process.env.REDIS_URL;
if (shouldRunInlineWorker) {
  startEmailWorker({ registerSignalHandlers: false })
    .then((handle) => {
      emailWorker = handle;
      console.warn('[backend] inline email worker started');
    })
    .catch((err: unknown) => {
      console.error('[backend] inline email worker failed to start:', err);
    });
}

const shutdown = async (signal: string) => {
  console.warn(`[backend] ${signal} received, closing`);
  if (emailWorker) {
    try {
      await emailWorker.close();
    } catch (err) {
      console.error('[backend] email worker drain failed:', err);
    }
  }
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
