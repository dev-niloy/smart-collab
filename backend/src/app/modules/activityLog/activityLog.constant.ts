export const ACTIONS = [
  'task.created',
  'task.updated',
  'task.deleted',
  'task.status_changed',
  'task.assigned',
  'task.unassigned',
  'project.created',
  'project.updated',
  'project.deleted',
  'member.added',
  'member.removed',
  'comment.created',
  'comment.deleted',
  'attachment.added',
  'attachment.removed',
] as const;

export type ActivityAction = (typeof ACTIONS)[number];

export const ENTITY_TYPES = ['task', 'project', 'member', 'user', 'comment', 'attachment'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

// Whitelist of meta fields allowed to persist. Anything outside is stripped
// so we never accidentally log credentials, tokens, or large blobs.
export const META_WHITELIST = [
  'title',
  'name',
  'status',
  'priority',
  'from',
  'to',
  'role',
  'userId',
  'assigneeId',
  'added',
  'removed',
  'projectId',
  'deadline',
  'dueDate',
  'description',
] as const;

export type MetaKey = (typeof META_WHITELIST)[number];

export const DEFAULT_ACTIVITY_LIMIT = 10;
export const MAX_ACTIVITY_LIMIT = 50;

// Cap any single string field stored in `meta` so a 50KB task description
// doesn't bloat an audit row. Truncation keeps a head + ellipsis so the
// reader can still see what the change was about.
export const META_STRING_CAP = 200;

export function isKnownAction(action: string): action is ActivityAction {
  return (ACTIONS as readonly string[]).includes(action);
}

const capString = (v: unknown): unknown => {
  if (typeof v !== 'string') return v;
  if (v.length <= META_STRING_CAP) return v;
  return `${v.slice(0, META_STRING_CAP - 1)}…`;
};

export function sanitizeMeta(input: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!input) return null;
  const out: Record<string, unknown> = {};
  for (const k of META_WHITELIST) {
    if (k in input && input[k] !== undefined) {
      out[k] = capString(input[k]);
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
