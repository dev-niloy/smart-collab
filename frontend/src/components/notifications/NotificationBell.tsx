'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  useNotifications,
  useUnreadCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/hooks/useNotifications';
import type { NotificationDTO } from '@/lib/schemas/notification';

const formatLine = (n: NotificationDTO): string => {
  const actor = n.actorName ?? 'Someone';
  const title = (n.payload?.taskTitle as string | undefined) ?? 'a task';
  if (n.type === 'task.assigned') return `${actor} assigned you to ${title}`;
  if (n.type === 'comment.created') return `${actor} commented on ${title}`;
  return `${actor} (${n.type})`;
};

const destination = (n: NotificationDTO): string | null => {
  const projectId = (n.payload?.projectId as string | undefined) ?? n.projectId ?? undefined;
  const taskId =
    (n.payload?.taskId as string | undefined) ?? (n.entityType === 'task' ? n.entityId : undefined);
  if (projectId && taskId) return `/projects/${projectId}/tasks/${taskId}`;
  return null;
};

function NotificationRow({
  notification,
  onClick,
}: {
  notification: NotificationDTO;
  onClick: () => void;
}) {
  const unread = notification.readAt === null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-sm hover:bg-accent rounded-sm ${
        unread ? 'font-medium' : 'text-muted-foreground'
      }`}
    >
      <span className="block">{formatLine(notification)}</span>
      <span className="block text-xs text-muted-foreground">
        {new Date(notification.createdAt).toLocaleString()}
      </span>
    </button>
  );
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const countQ = useUnreadCount();
  const listQ = useNotifications({ limit: 10 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  const items = useMemo(
    () => (listQ.data?.pages ?? []).flatMap((p) => p.items).slice(0, 10),
    [listQ.data?.pages],
  );
  const unreadCount = countQ.data?.count ?? 0;

  const onItemClick = async (n: NotificationDTO) => {
    if (!n.readAt) {
      markRead.mutate(n.id);
    }
    setOpen(false);
    const dest = destination(n);
    if (dest) router.push(dest);
  };

  const onMarkAll = async () => {
    await markAll.mutateAsync();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            className="relative"
          />
        }
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unreadCount > 0 && (
          <span
            data-testid="unread-badge"
            className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1 text-xs font-medium text-muted-foreground">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" onClick={onMarkAll} disabled={markAll.isPending}>
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {listQ.isLoading ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          <ul role="list" className="max-h-96 overflow-y-auto py-1">
            {items.map((n) => (
              <li key={n.id}>
                <NotificationRow notification={n} onClick={() => onItemClick(n)} />
              </li>
            ))}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
