import type { ProjectStatus } from '@/lib/schemas/project';

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On hold',
};

export const STATUS_VARIANT: Record<ProjectStatus, 'default' | 'secondary' | 'outline'> = {
  active: 'default',
  completed: 'secondary',
  on_hold: 'outline',
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
