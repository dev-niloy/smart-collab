import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

export type ValidationSources = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

export const validate = (schemas: ValidationSources): RequestHandler => {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);
        Object.assign(req.query, parsed);
      }
      if (schemas.params) {
        const parsed = schemas.params.parse(req.params);
        Object.assign(req.params, parsed);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};
