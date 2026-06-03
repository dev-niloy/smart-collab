'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  type ListProjectsParams,
} from '@/lib/projects';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  Project,
  ProjectListResponse,
} from '@/lib/schemas/project';

export const PROJECTS_KEY = ['projects'] as const;
export const projectKey = (id: string) => ['project', id] as const;

export const useProjects = (params?: ListProjectsParams) =>
  useQuery<ProjectListResponse>({
    queryKey: [...PROJECTS_KEY, params ?? {}] as const,
    queryFn: () => listProjects(params),
    staleTime: 10_000,
  });

export const useProject = (id: string | undefined) =>
  useQuery<Project>({
    queryKey: projectKey(id ?? ''),
    queryFn: () => getProject(id as string),
    enabled: !!id,
    staleTime: 10_000,
  });

const invalidateLists = (qc: ReturnType<typeof useQueryClient>) =>
  qc.invalidateQueries({ queryKey: PROJECTS_KEY });

export const useCreateProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: (project) => {
      qc.setQueryData(projectKey(project.id), project);
      void invalidateLists(qc);
    },
  });
};

export const useUpdateProject = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => updateProject(id, input),
    onSuccess: (project) => {
      qc.setQueryData(projectKey(project.id), project);
      void invalidateLists(qc);
    },
  });
};

export const useDeleteProject = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: (_v, id) => {
      qc.removeQueries({ queryKey: projectKey(id) });
      void invalidateLists(qc);
    },
  });
};
