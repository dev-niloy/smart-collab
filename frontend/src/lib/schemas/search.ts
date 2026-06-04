import { z } from 'zod';

export const ProjectHitSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(['active', 'completed', 'on_hold']),
  deadline: z.string(),
});

export const TaskHitSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  projectId: z.string(),
  projectName: z.string(),
  status: z.enum(['todo', 'in_progress', 'completed']),
  priority: z.enum(['low', 'medium', 'high']),
  dueDate: z.string(),
});

export const SearchResultSchema = z.object({
  projects: z.array(ProjectHitSchema),
  tasks: z.array(TaskHitSchema),
});

export type ProjectHit = z.infer<typeof ProjectHitSchema>;
export type TaskHit = z.infer<typeof TaskHitSchema>;
export type SearchResult = z.infer<typeof SearchResultSchema>;
