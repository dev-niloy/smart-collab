import type { TaskStatus, TaskPriority } from '@/lib/schemas/task';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Todo',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export const STATUS_VARIANT: Record<TaskStatus, BadgeVariant> = {
  todo: 'outline',
  in_progress: 'default',
  completed: 'secondary',
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

export const PRIORITY_VARIANT: Record<TaskPriority, BadgeVariant> = {
  low: 'outline',
  medium: 'secondary',
  high: 'destructive',
};

export const fmtDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
};

export const fmtDateTime = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};
