export const NOTIFICATION_TYPES = [
  'task.assigned',
  'task.unassigned',
  'task.status_changed',
  'comment.created',
  'comment.mention',
  'project.member_added',
  'project.member_role_changed',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const isKnownNotificationType = (t: string): t is NotificationType =>
  (NOTIFICATION_TYPES as readonly string[]).includes(t);

// Mirror of activityLog.META_WHITELIST — keeps payload safe (no secrets, capped).
export const PAYLOAD_WHITELIST = [
  'taskTitle',
  'projectName',
  'projectDescription',
  'projectDeadline',
  'commentExcerpt',
  'actorName',
  'taskId',
  'projectId',
  'commentId',
  'memberId',
  'newRole',
  'previousRole',
] as const;
export type PayloadKey = (typeof PAYLOAD_WHITELIST)[number];

export const PAYLOAD_STRING_CAP = 200;

export const DEFAULT_NOTIFICATION_LIST_LIMIT = 20;
export const MAX_NOTIFICATION_LIST_LIMIT = 50;

const capString = (v: unknown): unknown => {
  if (typeof v !== 'string') return v;
  if (v.length <= PAYLOAD_STRING_CAP) return v;
  return `${v.slice(0, PAYLOAD_STRING_CAP - 1)}…`;
};

export const sanitizeNotificationPayload = (
  input: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null => {
  if (!input) return null;
  const out: Record<string, unknown> = {};
  for (const k of PAYLOAD_WHITELIST) {
    if (k in input && input[k] !== undefined) {
      out[k] = capString(input[k]);
    }
  }
  return Object.keys(out).length > 0 ? out : null;
};
