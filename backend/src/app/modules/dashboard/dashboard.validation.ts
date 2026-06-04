import { z } from 'zod';
import {
  DEFAULT_PRODUCTIVITY_DAYS,
  DEFAULT_UPCOMING_DAYS,
  MIN_DAYS,
  MAX_DAYS,
} from './dashboard.constant';

const daysField = (defaultValue: number) =>
  z.coerce
    .number()
    .int()
    .min(MIN_DAYS, `days must be >= ${MIN_DAYS}`)
    .max(MAX_DAYS, `days must be <= ${MAX_DAYS}`)
    .default(defaultValue);

export const productivityQuerySchema = z.object({
  days: daysField(DEFAULT_PRODUCTIVITY_DAYS),
});

export const upcomingQuerySchema = z.object({
  days: daysField(DEFAULT_UPCOMING_DAYS),
});

export const projectIdParamSchema = z.object({
  id: z.string().uuid('Invalid id'),
});

export type ProductivityQuery = z.infer<typeof productivityQuerySchema>;
export type UpcomingQuery = z.infer<typeof upcomingQuerySchema>;
