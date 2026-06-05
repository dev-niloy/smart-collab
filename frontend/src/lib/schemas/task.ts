import { z } from 'zod';

export const TASK_STATUSES = ['todo', 'in_progress', 'completed'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const SORT_KEYS = ['created', 'dueDate', 'priority', 'updated'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const TASK_DEFAULT_LIMIT = 10;
export const TASK_MAX_LIMIT = 50;
export const TASK_DEFAULT_SORT: SortKey = 'created';

export const UNASSIGNED = 'unassigned' as const;

// Assessment §4 verbatim messages
export const PAST_DEADLINE_MESSAGE = 'Please select a valid deadline.';
export const DUPLICATE_TASK_TITLE_MESSAGE = 'Task title already exists in this project.';
export const REASSIGN_COMPLETED_MESSAGE = 'Cannot reassign a completed task.';

const titleField = z.string().trim().min(1, 'Title is required').max(200);
const descriptionField = z.string().trim().max(5000).optional();
const dueDateField = z.coerce.date({ error: 'Invalid due date' });
const statusField = z.enum(TASK_STATUSES);
const priorityField = z.enum(TASK_PRIORITIES);
const uuidField = z.string().uuid('Invalid id');

export const createTaskSchema = z.object({
  projectId: uuidField,
  title: titleField,
  description: descriptionField,
  dueDate: dueDateField,
  status: statusField.default('todo'),
  priority: priorityField.default('medium'),
  assignedTo: uuidField.nullable().optional(),
});

export const updateTaskSchema = z
  .object({
    title: titleField.optional(),
    description: descriptionField,
    dueDate: dueDateField.optional(),
    status: statusField.optional(),
    priority: priorityField.optional(),
    assignedTo: uuidField.nullable().optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.description !== undefined ||
      v.dueDate !== undefined ||
      v.status !== undefined ||
      v.priority !== undefined ||
      v.assignedTo !== undefined,
    { message: 'At least one field must be provided' },
  );

export const listTasksQuerySchema = z.object({
  projectId: uuidField.optional(),
  q: z.string().trim().min(1).max(200).optional(),
  status: statusField.optional(),
  priority: priorityField.optional(),
  assignedTo: z.string().optional(),
  sort: z.enum(SORT_KEYS).default(TASK_DEFAULT_SORT),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .default(TASK_DEFAULT_LIMIT)
    .transform((v) => Math.min(v, TASK_MAX_LIMIT)),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

export type TaskUser = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'project_manager' | 'team_member';
};

export type Task = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  assignedTo: string | null;
  createdBy: string;
  creator: TaskUser;
  assignee: TaskUser | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskListResponse = {
  data: Task[];
  total: number;
  page: number;
  limit: number;
};
