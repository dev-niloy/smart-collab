export const ACTIONS = [
  'task.created',
  'task.updated',
  'task.deleted',
  'task.status_changed',
  'task.assigned',
  'project.created',
  'project.updated',
  'project.deleted',
  'member.added',
  'member.removed',
] as const;

export type ActivityAction = (typeof ACTIONS)[number];

export const ENTITY_TYPES = ['task', 'project', 'member', 'user'] as const;
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
  'projectId',
  'deadline',
  'dueDate',
  'description',
] as const;

export type MetaKey = (typeof META_WHITELIST)[number];

export const DEFAULT_ACTIVITY_LIMIT = 10;
export const MAX_ACTIVITY_LIMIT = 50;

export function isKnownAction(action: string): action is ActivityAction {
  return (ACTIONS as readonly string[]).includes(action);
}

export function sanitizeMeta(input: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!input) return null;
  const out: Record<string, unknown> = {};
  for (const k of META_WHITELIST) {
    if (k in input && input[k] !== undefined) {
      out[k] = input[k];
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
