import { z } from 'zod';
import { MIN_Q, MAX_Q, DEFAULT_HIT_LIMIT, MAX_HIT_LIMIT } from './search.constant';

export const searchQuerySchema = z.object({
  q: z.string().trim().min(MIN_Q).max(MAX_Q),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_HIT_LIMIT)
    .default(DEFAULT_HIT_LIMIT),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
