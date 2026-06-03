import { ProjectStatus } from '@prisma/client';

export const STATUSES: ProjectStatus[] = [
  ProjectStatus.active,
  ProjectStatus.completed,
  ProjectStatus.on_hold,
];

export const SORT_KEYS = ['created', 'deadline', 'updated'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;
export const DEFAULT_PAGE = 1;
export const DEFAULT_SORT: SortKey = 'created';

export const PAST_DEADLINE_MESSAGE = 'Please select a valid deadline.';
