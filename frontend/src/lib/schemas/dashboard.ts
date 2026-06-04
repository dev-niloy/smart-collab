export type Kpis = {
  totalProjects: number;
  totalTasks: number;
  completedTasks: number;
  completionPct: number;
  myOpenTasks: number;
};

export type StatusCounts = { todo: number; in_progress: number; completed: number };
export type PriorityCounts = { low: number; medium: number; high: number };
export type ProductivityPoint = { date: string; completed: number };
export type ProductivityResponse = { data: ProductivityPoint[] };

export type UpcomingTask = {
  id: string;
  title: string;
  dueDate: string;
  projectId: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'completed';
};
export type UpcomingProject = { id: string; name: string; deadline: string };
export type UpcomingPayload = { tasks: UpcomingTask[]; projects: UpcomingProject[] };

export type HighPriorityTask = {
  id: string;
  title: string;
  projectId: string;
  dueDate: string;
  status: 'todo' | 'in_progress' | 'completed';
  assignee: { id: string; email: string; name: string } | null;
};
export type HighPriorityResponse = { data: HighPriorityTask[] };
