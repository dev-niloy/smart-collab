'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Topbar } from '@/components/shell/Topbar';
import { useNotifications, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import { useTasks } from '@/hooks/useTasks';
import type { NotificationDTO } from '@/lib/schemas/notification';
import type { Task } from '@/lib/schemas/task';

type Tab = 'unread' | 'mentions' | 'assigned';

const TABS: { key: Tab; label: string }[] = [
  { key: 'unread', label: 'Unread' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'assigned', label: 'Assigned to me' },
];

const formatNotificationLine = (n: NotificationDTO): string => {
  const actor = n.actorName ?? 'Someone';
  const title = (n.payload?.taskTitle as string | undefined) ?? 'a task';
  if (n.type === 'task.assigned') return `${actor} assigned you to ${title}`;
  if (n.type === 'comment.created') return `${actor} commented on ${title}`;
  if (n.type === 'comment.mention' || n.type === 'mention.created') {
    return `${actor} mentioned you on ${title}`;
  }
  return `${actor} · ${n.type}`;
};

const notificationHref = (n: NotificationDTO): string | null => {
  const projectId = (n.payload?.projectId as string | undefined) ?? n.projectId ?? null;
  const taskId =
    (n.payload?.taskId as string | undefined) ?? (n.entityType === 'task' ? n.entityId : null);
  if (projectId && taskId) return `/projects/${projectId}/tasks/${taskId}`;
  if (projectId) return `/projects/${projectId}`;
  return null;
};

function NotificationList({ notifications }: { notifications: NotificationDTO[] }) {
  if (notifications.length === 0) {
    return <p className="px-1 py-6 text-sm text-muted-foreground">Nothing here yet.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {notifications.map((n) => {
        const href = notificationHref(n);
        const body = (
          <>
            <span className={`block text-sm ${n.readAt === null ? 'font-medium' : 'text-muted-foreground'}`}>
              {formatNotificationLine(n)}
            </span>
            <span className="block text-xs text-muted-foreground">
              {new Date(n.createdAt).toLocaleString()}
            </span>
          </>
        );
        return (
          <li key={n.id} className="py-2">
            {href ? (
              <Link href={href} className="block rounded-md px-2 py-1 hover:bg-accent">
                {body}
              </Link>
            ) : (
              <div className="px-2 py-1">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function TaskList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return <p className="px-1 py-6 text-sm text-muted-foreground">No tasks assigned to you.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {tasks.map((t) => (
        <li key={t.id} className="py-2">
          <Link
            href={`/projects/${t.projectId}/tasks/${t.id}`}
            className="block rounded-md px-2 py-1 hover:bg-accent"
          >
            <span className="block text-sm font-medium">{t.title}</span>
            <span className="block text-xs text-muted-foreground">
              {t.status} · due {new Date(t.dueDate).toLocaleDateString()}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function InboxPage() {
  const [active, setActive] = useState<Tab>('unread');

  const notifications = useNotifications({ limit: 20, unread: active === 'unread' });
  const items: NotificationDTO[] = useMemo(
    () => (notifications.data?.pages ?? []).flatMap((p) => p.items),
    [notifications.data],
  );

  const mentions = useMemo(
    () =>
      items.filter(
        (n) => n.type === 'comment.mention' || n.type === 'mention.created' || n.type.includes('mention'),
      ),
    [items],
  );

  const myTasks = useTasks({ assignedTo: 'me', limit: 50 });
  const tasks = myTasks.data?.data ?? [];

  const markAllRead = useMarkAllNotificationsRead();

  return (
    <div className="flex h-full flex-col">
      <Topbar
        segments={['Inbox']}
        actions={
          active === 'unread' && items.length > 0 ? (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent"
            >
              Mark all read
            </button>
          ) : null
        }
      />

      <div role="tablist" aria-label="Inbox tabs" className="flex gap-1 border-b border-border px-4 py-2">
        {TABS.map((t) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              data-selected={selected ? 'true' : 'false'}
              onClick={() => setActive(t.key)}
              className={
                'rounded-md px-3 py-1 text-sm ' +
                (selected
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground')
              }
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {active === 'unread' && <NotificationList notifications={items} />}
        {active === 'mentions' && <NotificationList notifications={mentions} />}
        {active === 'assigned' && <TaskList tasks={tasks} />}
      </div>
    </div>
  );
}
