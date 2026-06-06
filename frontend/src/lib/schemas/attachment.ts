import { z } from 'zod';

// Mirror of backend MAX_ATTACHMENT_SIZE. Frontend single source of truth so
// the panel's client-side size guard does not drift from the server limit.
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

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
