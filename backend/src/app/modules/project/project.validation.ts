import { z } from 'zod';
import { ProjectStatus } from '@prisma/client';
import {
  STATUSES,
  SORT_KEYS,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  DEFAULT_PAGE,
  DEFAULT_SORT,
} from './project.constant';
import { csvOfEnum, isoDateField, meOrUuid } from '../../lib/queryFields';

const nameField = z.string().trim().min(1, 'Name is required').max(200);
const descriptionField = z.string().trim().max(5000).optional();
const deadlineField = z.coerce.date({
  errorMap: () => ({ message: 'Invalid deadline date' }),
});
const statusField = z.nativeEnum(ProjectStatus);

export const createProjectSchema = z.object({
  name: nameField,
  description: descriptionField,
  deadline: deadlineField,
  status: statusField.default(ProjectStatus.active),
});

export const updateProjectSchema = z
  .object({
    name: nameField.optional(),
    description: descriptionField,
    deadline: deadlineField.optional(),
    status: statusField.optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.description !== undefined ||
      v.deadline !== undefined ||
      v.status !== undefined,
    { message: 'At least one field must be provided' },
  );

export const listProjectsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    status: csvOfEnum(STATUSES),
    createdBy: meOrUuid,
    deadlineFrom: isoDateField,
    deadlineTo: isoDateField,
    sort: z.enum(SORT_KEYS).default(DEFAULT_SORT),
    page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .default(DEFAULT_LIMIT)
      .transform((v) => Math.min(v, MAX_LIMIT)),
  })
  .refine(
    (v) =>
      !(v.deadlineFrom && v.deadlineTo) ||
      v.deadlineFrom.getTime() <= v.deadlineTo.getTime(),
    { message: 'deadlineFrom must be on or before deadlineTo', path: ['deadlineFrom'] },
  );

export const projectIdParamSchema = z.object({
  id: z.string().uuid('Invalid project id'),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
export type ProjectIdParam = z.infer<typeof projectIdParamSchema>;
