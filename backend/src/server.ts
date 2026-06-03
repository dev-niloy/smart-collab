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

const port = envValues.PORT;

const server = app.listen(port, () => {
  console.warn(`[backend] listening on http://localhost:${port}`);
});

const shutdown = (signal: string) => {
  console.warn(`[backend] ${signal} received, closing`);
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
