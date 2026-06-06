import type { ErrorRequestHandler, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../errors/ApiError';
import { handleZodError } from '../errors/handleZodError';

type ErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

const toApiError = (err: unknown): ApiError => {
  if (err instanceof ApiError) return err;
  if (err instanceof ZodError) return handleZodError(err);
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    return ApiError.badRequest('Malformed JSON body', 'INVALID_JSON');
  }
  if (err instanceof Error) return ApiError.internal(err.message);
  return ApiError.internal('Unknown error');
};

export const notFoundHandler = (_req: Request, res: Response): void => {
  const payload: ErrorPayload = {
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  };
  res.status(404).json(payload);
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const apiErr = toApiError(err);
  const payload: ErrorPayload = {
    error: {
      code: apiErr.code ?? 'INTERNAL',
      message: apiErr.message,
      ...(apiErr.details !== undefined ? { details: apiErr.details } : {}),
    },
  };
  res.status(apiErr.statusCode).json(payload);
};
