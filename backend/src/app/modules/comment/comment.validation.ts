import { z } from 'zod';
import {
  MIN_COMMENT_BODY,
  MAX_COMMENT_BODY,
  DEFAULT_COMMENT_LIST_LIMIT,
  MAX_COMMENT_LIST_LIMIT,
} from './comment.constant';

const bodyField = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(MIN_COMMENT_BODY).max(MAX_COMMENT_BODY));

export const createCommentBodySchema = z.object({ body: bodyField });
export const updateCommentBodySchema = z.object({ body: bodyField });

export const listCommentsQuerySchema = z.object({
  limit: z
    .preprocess(
      (v) => (v === undefined ? undefined : Number(v)),
      z.number().int().min(1).max(MAX_COMMENT_LIST_LIMIT),
    )
    .default(DEFAULT_COMMENT_LIST_LIMIT),
  cursor: z.string().optional(),
});

export type CreateCommentBody = z.infer<typeof createCommentBodySchema>;
export type UpdateCommentBody = z.infer<typeof updateCommentBodySchema>;
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
