import { ZodError } from 'zod';
import { ApiError } from './ApiError';

export const handleZodError = (err: ZodError): ApiError => {
  const issues = err.issues.map((i) => ({
    path: i.path.map((p) => String(p)).join('.'),
    message: i.message,
  }));
  return ApiError.unprocessable('Validation failed', 'VALIDATION_ERROR', issues);
};
