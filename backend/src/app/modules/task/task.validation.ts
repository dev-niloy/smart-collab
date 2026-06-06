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

export const createTaskSchema = z
  .object({
    projectId: uuidField,
    title: titleField,
    description: descriptionField,
    dueDate: dueDateField,
    status: statusField.default(TaskStatus.todo),
    priority: priorityField.default(TaskPriority.medium),
    assignedTo: uuidField.nullable().optional(),
    assigneeIds: z.array(uuidField).max(50).optional(),
  })
  .refine(
    (v) => !(v.assignedTo !== undefined && v.assigneeIds !== undefined),
    {
      message: 'Use assigneeIds (preferred) or legacy assignedTo, not both',
      path: ['assigneeIds'],
    },
  );

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
    if (v === 'me') return 'me' as const;
    const parsed = z.string().uuid().safeParse(v);
    return parsed.success ? parsed.data : undefined;
  });

const createdByFilterField = z
  .string()
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    if (v === 'me') return 'me' as const;
    const parsed = z.string().uuid().safeParse(v);
    return parsed.success ? parsed.data : undefined;
  });

// CSV → array of valid enum members. Unknown tokens silently dropped so a
// single bad value never 422s the whole request (back-compat: callers that
// pass one stale enum keep working). Empty array means "no filter".
const csvOfEnum = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .optional()
    .transform((v): T[] | undefined => {
      if (!v) return undefined;
      const allowed = new Set<string>(values);
      const out = v
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && allowed.has(s));
      return out.length > 0 ? (out as T[]) : undefined;
    });

const isoDateField = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return undefined;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid ISO date' });
      return z.NEVER;
    }
    return d;
  });

export const listTasksQuerySchema = z
  .object({
    projectId: uuidField.optional(),
    q: z.string().trim().min(1).max(200).optional(),
    status: csvOfEnum(STATUSES),
    priority: csvOfEnum(PRIORITIES),
    assignedTo: assignedToFilterField,
    createdBy: createdByFilterField,
    dueFrom: isoDateField,
    dueTo: isoDateField,
    sort: z.enum(SORT_KEYS).default(DEFAULT_SORT),
    page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .default(DEFAULT_LIMIT)
      .transform((v) => Math.min(v, MAX_LIMIT)),
    includeDeleted: z
      .union([z.literal('true'), z.literal('false'), z.boolean()])
      .optional()
      .transform((v) => v === 'true' || v === true),
  })
  .refine(
    (v) => !(v.dueFrom && v.dueTo) || v.dueFrom.getTime() <= v.dueTo.getTime(),
    { message: 'dueFrom must be on or before dueTo', path: ['dueFrom'] },
  );

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
