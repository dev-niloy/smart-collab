import type { ActivityDTO } from '@/lib/schemas/activity';

type Meta = Record<string, unknown>;

const m = (a: ActivityDTO): Meta => (a.meta ?? {}) as Meta;

export const renderVerb = (a: ActivityDTO): string => {
  switch (a.action) {
    case 'task.created':
      return `created task “${(m(a).title as string) ?? 'untitled'}”`;
    case 'task.updated':
      return `updated task “${(m(a).title as string) ?? 'untitled'}”`;
    case 'task.deleted':
      return `deleted task “${(m(a).title as string) ?? 'untitled'}”`;
    case 'task.status_changed':
      return `moved task to ${(m(a).to as string) ?? 'a new status'}`;
    case 'task.assigned':
      return m(a).to ? 'reassigned task' : 'unassigned task';
    case 'project.created':
      return `created project “${(m(a).name as string) ?? 'untitled'}”`;
    case 'project.updated':
      return `updated project “${(m(a).name as string) ?? 'untitled'}”`;
    case 'project.deleted':
      return `deleted project “${(m(a).name as string) ?? 'untitled'}”`;
    case 'member.added':
      return `added ${(m(a).name as string) ?? 'a member'} to the project`;
    case 'member.removed':
      return 'removed a member from the project';
    default:
      return a.action;
  }
};

// Lightweight relative-time formatter so we don't pull in date-fns just for one helper.
export const relTime = (iso: string, now: Date = new Date()): string => {
  const t = new Date(iso).getTime();
  const diff = Math.max(0, now.getTime() - t);
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(d / 365);
  return `${y}y ago`;
};

export const entityLink = (a: ActivityDTO): string | null => {
  if (a.entityType === 'project' && a.entityId) return `/projects/${a.entityId}`;
  if (a.entityType === 'task' && a.projectId) return `/projects/${a.projectId}/tasks`;
  return null;
};
