import { z } from 'zod';

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
