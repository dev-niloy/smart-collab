import type { TaskAssigneeRel, TaskUser } from '@/lib/schemas/task';

export const MAX_VISIBLE = 3;

const initials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || parts[0].length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const colorForId = (id: string): string => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const palette = [
    'bg-blue-600',
    'bg-emerald-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-violet-600',
    'bg-cyan-600',
    'bg-fuchsia-600',
  ];
  return palette[h % palette.length];
};

type Props =
  | { assignees: TaskAssigneeRel[]; users?: never }
  | { assignees?: never; users: TaskUser[] };

export function TaskAssigneesAvatars(props: Props) {
  const users: TaskUser[] =
    'users' in props && props.users
      ? props.users
      : (props.assignees ?? []).map((a) => a.user);
  if (users.length === 0) {
    return (
      <span
        className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
        data-testid="task-unassigned"
      >
        Unassigned
      </span>
    );
  }
  const visible = users.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, users.length - MAX_VISIBLE);
  return (
    <div className="flex -space-x-1.5" data-testid="task-assignees">
      {visible.map((u) => (
        <span
          key={u.id}
          title={`${u.name} (${u.email})`}
          aria-label={u.name}
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium text-white/95 ring-2 ring-background ${colorForId(u.id)}`}
        >
          {initials(u.name)}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-foreground ring-2 ring-background"
          aria-label={`+${overflow} more assignees`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
