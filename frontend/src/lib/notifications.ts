import { apiGet, apiPost } from './api';
import {
  NotificationDTOSchema,
  NotificationPageSchema,
  UnreadCountSchema,
  ReadAllResultSchema,
  type NotificationDTO,
  type NotificationPage,
  type UnreadCount,
  type ReadAllResult,
} from './schemas/notification';

type ListArgs = { limit?: number; cursor?: string; unread?: boolean };

const buildQuery = (args?: ListArgs): string => {
  const p = new URLSearchParams();
  if (args?.limit !== undefined) p.set('limit', String(args.limit));
  if (args?.cursor) p.set('cursor', args.cursor);
  if (args?.unread) p.set('unread', 'true');
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const listNotifications = async (args?: ListArgs): Promise<NotificationPage> => {
  const raw = await apiGet<unknown>(`/api/v1/notifications${buildQuery(args)}`);
  return NotificationPageSchema.parse(raw);
};

export const getUnreadCount = async (): Promise<UnreadCount> => {
  const raw = await apiGet<unknown>('/api/v1/notifications/unread-count');
  return UnreadCountSchema.parse(raw);
};

export const markNotificationRead = async (id: string): Promise<NotificationDTO> => {
  const raw = await apiPost<{ notification: unknown }>(`/api/v1/notifications/${id}/read`);
  return NotificationDTOSchema.parse(raw.notification);
};

export const markAllNotificationsRead = async (): Promise<ReadAllResult> => {
  const raw = await apiPost<unknown>('/api/v1/notifications/read-all');
  return ReadAllResultSchema.parse(raw);
};
