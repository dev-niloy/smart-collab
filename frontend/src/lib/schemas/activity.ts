import { z } from 'zod';

export const ActivityDTOSchema = z.object({
  id: z.string(),
  action: z.string(),
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  entityType: z.string(),
  entityId: z.string(),
  projectId: z.string().nullable(),
  meta: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
});

export type ActivityDTO = z.infer<typeof ActivityDTOSchema>;

export const ActivityPageSchema = z.object({
  items: z.array(ActivityDTOSchema),
  nextCursor: z.string().nullable(),
});

export type ActivityPage = z.infer<typeof ActivityPageSchema>;
