'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  listTasks,
  listTasksForProject,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  restoreTask,
  replaceTaskAssignees,
  type ListTasksParams,
} from '@/lib/tasks';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  Task,
  TaskListResponse,
} from '@/lib/schemas/task';
import { PROJECTS_KEY, projectKey } from './useProjects';

export const TASKS_KEY = ['tasks'] as const;
export const projectTasksKey = (projectId: string) => ['tasks', 'project', projectId] as const;
export const taskKey = (id: string) => ['task', id] as const;
const DASHBOARD_KEY = ['dashboard'] as const;

export const useTasks = (params?: ListTasksParams) =>
  useQuery<TaskListResponse>({
    queryKey: [...TASKS_KEY, params ?? {}] as const,
    queryFn: () => listTasks(params),
    staleTime: 10_000,
  });

export const useProjectTasks = (
  projectId: string | undefined,
  params?: Omit<ListTasksParams, 'projectId'>,
) =>
  useQuery<TaskListResponse>({
    queryKey: [...projectTasksKey(projectId ?? ''), params ?? {}] as const,
    queryFn: () => listTasksForProject(projectId as string, params),
    enabled: !!projectId,
    staleTime: 10_000,
  });

export const useTask = (id: string | undefined) =>
  useQuery<Task>({
    queryKey: taskKey(id ?? ''),
    queryFn: () => getTask(id as string),
    enabled: !!id,
    staleTime: 10_000,
  });

const invalidateLists = (qc: ReturnType<typeof useQueryClient>, projectId?: string) => {
  void qc.invalidateQueries({ queryKey: TASKS_KEY });
  void qc.invalidateQueries({ queryKey: PROJECTS_KEY });
  if (projectId) void qc.invalidateQueries({ queryKey: projectKey(projectId) });
  void qc.invalidateQueries({ queryKey: DASHBOARD_KEY });
};

export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: (task) => {
      qc.setQueryData(taskKey(task.id), task);
      invalidateLists(qc, task.projectId);
    },
  });
};

export const useUpdateTask = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => updateTask(id, input),
    onSuccess: (task) => {
      qc.setQueryData(taskKey(task.id), task);
      invalidateLists(qc, task.projectId);
    },
  });
};

export const useDeleteTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: (_v, id) => {
      qc.removeQueries({ queryKey: taskKey(id) });
      invalidateLists(qc);
    },
  });
};

export const useRestoreTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreTask(id),
    onSuccess: (task) => {
      qc.setQueryData(taskKey(task.id), task);
      invalidateLists(qc, task.projectId);
    },
  });
};

export const useReplaceAssignees = (taskId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) => replaceTaskAssignees(taskId, userIds),
    onSuccess: (task) => {
      qc.setQueryData(taskKey(task.id), task);
      invalidateLists(qc, task.projectId);
    },
  });
};
