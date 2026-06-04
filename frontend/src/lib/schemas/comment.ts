import { z } from 'zod';

// Mirror of backend MAX_COMMENT_BODY. Kept here as the single source of truth
// for the frontend so panel + form + tests don't drift independently.
export const MAX_COMMENT_BODY = 2000;
export const MIN_COMMENT_BODY = 1;

export const CommentDTOSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  body: z.string(),
  author: z.object({ id: z.string(), name: z.string() }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CommentDTO = z.infer<typeof CommentDTOSchema>;

export const CommentPageSchema = z.object({
  items: z.array(CommentDTOSchema),
  nextCursor: z.string().nullable(),
});

export type CommentPage = z.infer<typeof CommentPageSchema>;
