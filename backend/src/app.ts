import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';

import rootRouter from './app/routes';

const parseOrigins = (raw: string | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
};

const buildApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');

  if (process.env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
      }),
    );
  }

  app.use(helmet());

  const origins = parseOrigins(process.env.CORS_ORIGINS);
  app.use(
    cors({
      origin: origins.length > 0 ? origins : false,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  app.use(rootRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: { code: 'INTERNAL', message: err.message || 'Internal server error' } });
  });

  return app;
};

const app = buildApp();
export default app;
