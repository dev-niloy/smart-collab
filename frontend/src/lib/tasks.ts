import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksQuery,
  Task,
  TaskListResponse,
} from './schemas/task';

type TaskResponse = { task: Task };

export type ListTasksParams = {
  projectId?: string;
  q?: string;
  status?: string; // csv allowed
  priority?: string; // csv allowed
  assignedTo?: string; // uuid, UNASSIGNED, or 'me'
  createdBy?: string; // uuid or 'me'
  dueFrom?: string;
  dueTo?: string;
  sort?: ListTasksQuery['sort'];
  page?: number;
  limit?: number;
};

const buildQuery = (params: ListTasksParams = {}): string => {
  const usp = new URLSearchParams();
  if (params.projectId) usp.set('projectId', params.projectId);
  if (params.q) usp.set('q', params.q);
  if (params.status) usp.set('status', params.status);
  if (params.priority) usp.set('priority', params.priority);
  if (params.assignedTo) usp.set('assignedTo', params.assignedTo);
  if (params.createdBy) usp.set('createdBy', params.createdBy);
  if (params.dueFrom) usp.set('dueFrom', params.dueFrom);
  if (params.dueTo) usp.set('dueTo', params.dueTo);
  if (params.sort) usp.set('sort', params.sort);
  if (params.page !== undefined) usp.set('page', String(params.page));
  if (params.limit !== undefined) usp.set('limit', String(params.limit));
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
};

const serializeCreate = (input: CreateTaskInput) => ({
  ...input,
  dueDate: input.dueDate instanceof Date ? input.dueDate.toISOString() : input.dueDate,
});

const serializeUpdate = (input: UpdateTaskInput) => ({
  ...input,
  ...(input.dueDate instanceof Date ? { dueDate: input.dueDate.toISOString() } : {}),
});

export const listTasks = (params?: ListTasksParams) =>
  apiGet<TaskListResponse>(`/api/v1/tasks${buildQuery(params)}`);

export const listTasksForProject = (projectId: string, params?: Omit<ListTasksParams, 'projectId'>) =>
  apiGet<TaskListResponse>(`/api/v1/projects/${projectId}/tasks${buildQuery(params)}`);

export const getTask = (id: string) =>
  apiGet<TaskResponse>(`/api/v1/tasks/${id}`).then((r) => r.task);

export const createTask = (input: CreateTaskInput) =>
  apiPost<TaskResponse>('/api/v1/tasks', serializeCreate(input)).then((r) => r.task);

export const updateTask = (id: string, input: UpdateTaskInput) =>
  apiPatch<TaskResponse>(`/api/v1/tasks/${id}`, serializeUpdate(input)).then((r) => r.task);

export const deleteTask = (id: string) => apiDelete<void>(`/api/v1/tasks/${id}`);
