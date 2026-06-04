'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  listTasks,
  listTasksForProject,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  type ListTasksParams,
} from '@/lib/tasks';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  Task,
  TaskListResponse,
} from '@/lib/schemas/task';

export const TASKS_KEY = ['tasks'] as const;
export const projectTasksKey = (projectId: string) => ['tasks', 'project', projectId] as const;
export const taskKey = (id: string) => ['task', id] as const;

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

const invalidateLists = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: TASKS_KEY });

export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: (task) => {
      qc.setQueryData(taskKey(task.id), task);
      void invalidateLists(qc);
    },
  });
};

export const useUpdateTask = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTaskInput) => updateTask(id, input),
    onSuccess: (task) => {
      qc.setQueryData(taskKey(task.id), task);
      void invalidateLists(qc);
    },
  });
};

export const useDeleteTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: (_v, id) => {
      qc.removeQueries({ queryKey: taskKey(id) });
      void invalidateLists(qc);
    },
  });
};
