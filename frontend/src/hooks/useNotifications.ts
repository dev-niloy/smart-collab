'use client';

import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/notifications';
import type { NotificationPage, UnreadCount } from '@/lib/schemas/notification';

export const notificationsKey = (unread: boolean, limit: number) =>
  ['notifications', unread ? 'unread' : 'all', limit] as const;

export const unreadCountKey = () => ['notifications', 'unread-count'] as const;

export const useNotifications = (opts: { limit?: number; unread?: boolean } = {}) => {
  const limit = opts.limit ?? 10;
  const unread = !!opts.unread;
  return useInfiniteQuery<NotificationPage>({
    queryKey: notificationsKey(unread, limit),
    queryFn: ({ pageParam }) =>
      listNotifications({ limit, unread, cursor: pageParam as string | undefined }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15_000,
  });
};

export const useUnreadCount = () =>
  useQuery<UnreadCount>({
    queryKey: unreadCountKey(),
    queryFn: getUnreadCount,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
};
