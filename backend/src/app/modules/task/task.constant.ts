import { TaskStatus, TaskPriority } from '@prisma/client';

export const STATUSES: TaskStatus[] = [
  TaskStatus.todo,
  TaskStatus.in_progress,
  TaskStatus.completed,
];

export const PRIORITIES: TaskPriority[] = [
  TaskPriority.low,
  TaskPriority.medium,
  TaskPriority.high,
];

export const SORT_KEYS = ['created', 'dueDate', 'priority', 'updated'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;
export const DEFAULT_PAGE = 1;
export const DEFAULT_SORT: SortKey = 'created';

export const UNASSIGNED = 'unassigned' as const;

// Assessment §4 verbatim messages — do not edit copy.
export const PAST_DEADLINE_MESSAGE = 'Please select a valid deadline.';
export const DUPLICATE_TASK_TITLE_MESSAGE = 'Task title already exists in this project.';
export const REASSIGN_COMPLETED_MESSAGE = 'Cannot reassign a completed task.';
export const ASSIGNEE_NOT_PROJECT_MEMBER_MESSAGE = 'Assignee must be a member of this project.';
