import { z } from 'zod';
import { DEFAULT_NOTIFICATION_LIST_LIMIT, MAX_NOTIFICATION_LIST_LIMIT } from './notification.constant';

export const listNotificationsQuerySchema = z.object({
  limit: z
    .preprocess(
      (v) => (v === undefined ? undefined : Number(v)),
      z.number().int().min(1).max(MAX_NOTIFICATION_LIST_LIMIT),
    )
    .default(DEFAULT_NOTIFICATION_LIST_LIMIT),
  cursor: z.string().optional(),
  unread: z
    .preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean())
    .optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
