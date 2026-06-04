import { z } from 'zod';

export const NotificationDTOSchema = z.object({
  id: z.string(),
  type: z.string(),
  actorId: z.string().nullable(),
  actorName: z.string().nullable(),
  entityType: z.string(),
  entityId: z.string(),
  projectId: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

export type NotificationDTO = z.infer<typeof NotificationDTOSchema>;

export const NotificationPageSchema = z.object({
  items: z.array(NotificationDTOSchema),
  nextCursor: z.string().nullable(),
});

export type NotificationPage = z.infer<typeof NotificationPageSchema>;

export const UnreadCountSchema = z.object({ count: z.number().int().nonnegative() });
export type UnreadCount = z.infer<typeof UnreadCountSchema>;

export const ReadAllResultSchema = z.object({ updated: z.number().int().nonnegative() });
export type ReadAllResult = z.infer<typeof ReadAllResultSchema>;
