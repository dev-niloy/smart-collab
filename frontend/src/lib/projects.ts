import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsQuery,
  Project,
  ProjectListResponse,
} from './schemas/project';

type ProjectResponse = { project: Project };

export type ListProjectsParams = {
  q?: string;
  status?: string; // single value or comma-separated csv
  createdBy?: string; // uuid or literal "me"
  deadlineFrom?: string;
  deadlineTo?: string;
  sort?: ListProjectsQuery['sort'];
  page?: number;
  limit?: number;
};

const buildQuery = (params: ListProjectsParams = {}): string => {
  const usp = new URLSearchParams();
  if (params.q) usp.set('q', params.q);
  if (params.status) usp.set('status', params.status);
  if (params.createdBy) usp.set('createdBy', params.createdBy);
  if (params.deadlineFrom) usp.set('deadlineFrom', params.deadlineFrom);
  if (params.deadlineTo) usp.set('deadlineTo', params.deadlineTo);
  if (params.sort) usp.set('sort', params.sort);
  if (params.page !== undefined) usp.set('page', String(params.page));
  if (params.limit !== undefined) usp.set('limit', String(params.limit));
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
};

const serializeCreate = (input: CreateProjectInput) => ({
  ...input,
  deadline: input.deadline instanceof Date ? input.deadline.toISOString() : input.deadline,
});

const serializeUpdate = (input: UpdateProjectInput) => ({
  ...input,
  ...(input.deadline instanceof Date ? { deadline: input.deadline.toISOString() } : {}),
});

export const listProjects = (params?: ListProjectsParams) =>
  apiGet<ProjectListResponse>(`/api/v1/projects${buildQuery(params)}`);

export const getProject = (id: string) =>
  apiGet<ProjectResponse>(`/api/v1/projects/${id}`).then((r) => r.project);

export const createProject = (input: CreateProjectInput) =>
  apiPost<ProjectResponse>('/api/v1/projects', serializeCreate(input)).then((r) => r.project);

export const updateProject = (id: string, input: UpdateProjectInput) =>
  apiPatch<ProjectResponse>(`/api/v1/projects/${id}`, serializeUpdate(input)).then((r) => r.project);

export const deleteProject = (id: string) => apiDelete<void>(`/api/v1/projects/${id}`);
