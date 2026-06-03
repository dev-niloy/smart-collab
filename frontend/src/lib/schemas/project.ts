import { z } from 'zod';

export const PROJECT_STATUSES = ['active', 'completed', 'on_hold'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const SORT_KEYS = ['created', 'deadline', 'updated'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const PROJECT_DEFAULT_LIMIT = 10;
export const PROJECT_MAX_LIMIT = 50;
export const PROJECT_DEFAULT_SORT: SortKey = 'created';
export const PAST_DEADLINE_MESSAGE = 'Please select a valid deadline.';

const nameField = z.string().trim().min(1, 'Name is required').max(200);
const descriptionField = z.string().trim().max(5000).optional();
const deadlineField = z.coerce.date({ error: 'Invalid deadline date' });
const statusField = z.enum(PROJECT_STATUSES);

export const createProjectSchema = z.object({
  name: nameField,
  description: descriptionField,
  deadline: deadlineField,
  status: statusField.default('active'),
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

export const listProjectsQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  status: statusField.optional(),
  sort: z.enum(SORT_KEYS).default(PROJECT_DEFAULT_SORT),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .default(PROJECT_DEFAULT_LIMIT)
    .transform((v) => Math.min(v, PROJECT_MAX_LIMIT)),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

export type ProjectCreator = {
  id: string;
  email: string;
  name: string;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  deadline: string;
  status: ProjectStatus;
  createdBy: string;
  creator: ProjectCreator;
  createdAt: string;
  updatedAt: string;
};

export type ProjectListResponse = {
  data: Project[];
  total: number;
  page: number;
  limit: number;
};
