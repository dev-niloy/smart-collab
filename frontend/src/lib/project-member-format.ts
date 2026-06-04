import type { ProjectRole, Workload } from '@/lib/schemas/project-member';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

export const PROJECT_ROLE_LABEL: Record<ProjectRole, string> = {
  pm: 'Project Manager',
  member: 'Member',
};

export const PROJECT_ROLE_VARIANT: Record<ProjectRole, BadgeVariant> = {
  pm: 'default',
  member: 'outline',
};

// Heuristic for workload urgency (total non-completed assigned).
export const workloadTone = (w: Workload): BadgeVariant => {
  const active = w.todo + w.in_progress;
  if (active >= 10) return 'destructive';
  if (active >= 5) return 'secondary';
  return 'outline';
};

export const activeWorkloadCount = (w: Workload): number => w.todo + w.in_progress;
