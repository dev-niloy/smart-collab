import { z } from 'zod';
import { TaskStatus, TaskPriority } from '@prisma/client';
import {
  STATUSES,
  PRIORITIES,
  SORT_KEYS,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  DEFAULT_PAGE,
  DEFAULT_SORT,
  UNASSIGNED,
} from './task.constant';

const titleField = z.string().trim().min(1, 'Title is required').max(200);
const descriptionField = z.string().trim().max(5000).optional();
const dueDateField = z.coerce.date({
  errorMap: () => ({ message: 'Invalid due date' }),
});
const statusField = z.nativeEnum(TaskStatus);
const priorityField = z.nativeEnum(TaskPriority);
const uuidField = z.string().uuid('Invalid id');

export const createTaskSchema = z.object({
  projectId: uuidField,
  title: titleField,
  description: descriptionField,
  dueDate: dueDateField,
  status: statusField.default(TaskStatus.todo),
  priority: priorityField.default(TaskPriority.medium),
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

const assignedToFilterField = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    if (v === UNASSIGNED) return UNASSIGNED;
    const parsed = z.string().uuid().safeParse(v);
    return parsed.success ? parsed.data : undefined;
  });

export const listTasksQuerySchema = z.object({
  projectId: uuidField.optional(),
  q: z.string().trim().min(1).max(200).optional(),
  status: z
    .string()
    .optional()
    .transform((v) =>
      v && (STATUSES as string[]).includes(v) ? (v as TaskStatus) : undefined,
    ),
  priority: z
    .string()
    .optional()
    .transform((v) =>
      v && (PRIORITIES as string[]).includes(v) ? (v as TaskPriority) : undefined,
    ),
  assignedTo: assignedToFilterField,
  sort: z.enum(SORT_KEYS).default(DEFAULT_SORT),
  page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .default(DEFAULT_LIMIT)
    .transform((v) => Math.min(v, MAX_LIMIT)),
});

export const taskIdParamSchema = z.object({
  id: uuidField,
});

export const projectIdParamSchema = z.object({
  id: uuidField,
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type TaskIdParam = z.infer<typeof taskIdParamSchema>;
