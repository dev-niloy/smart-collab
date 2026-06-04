import { z } from 'zod';

export const AttachmentDTOSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  uploader: z.object({ id: z.string(), name: z.string() }),
  createdAt: z.string(),
});

export type AttachmentDTO = z.infer<typeof AttachmentDTOSchema>;

export const AttachmentListSchema = z.object({
  items: z.array(AttachmentDTOSchema),
});

export type AttachmentList = z.infer<typeof AttachmentListSchema>;
