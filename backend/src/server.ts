import 'dotenv/config';
import app from './app';

const port = Number(process.env.PORT) || 4000;

const server = app.listen(port, () => {
  console.warn(`[backend] listening on http://localhost:${port}`);
});

const shutdown = (signal: string) => {
  console.warn(`[backend] ${signal} received, closing`);
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
