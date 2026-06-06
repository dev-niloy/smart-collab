'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  listProjectMembers,
  listAssignableMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
} from '@/lib/project-members';
import type {
  AddMemberInput,
  UpdateMemberRoleInput,
  ProjectMember,
  AssignableMember,
  RemoveMemberResponse,
} from '@/lib/schemas/project-member';
import { TASKS_KEY } from '@/hooks/useTasks';

export const projectMembersKey = (projectId: string) =>
  ['project-members', projectId] as const;
export const assignableMembersKey = (projectId: string) =>
  ['project-members', projectId, 'assignable'] as const;

export const useProjectMembers = (projectId: string | undefined) =>
  useQuery<ProjectMember[]>({
    queryKey: projectMembersKey(projectId ?? ''),
    queryFn: () => listProjectMembers(projectId as string),
    enabled: !!projectId,
    staleTime: 10_000,
  });

export const useAssignableMembers = (projectId: string | undefined) =>
  useQuery<AssignableMember[]>({
    queryKey: assignableMembersKey(projectId ?? ''),
    queryFn: () => listAssignableMembers(projectId as string),
    enabled: !!projectId,
    staleTime: 30_000,
  });

const invalidateMembers = (
  qc: ReturnType<typeof useQueryClient>,
  projectId: string,
) => qc.invalidateQueries({ queryKey: ['project-members', projectId] });

export const useAddMember = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddMemberInput) => addProjectMember(projectId, input),
    onSuccess: () => {
      void invalidateMembers(qc, projectId);
    },
  });
};

export const useUpdateMemberRole = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { memberId: string; input: UpdateMemberRoleInput }) =>
      updateProjectMemberRole(projectId, vars.memberId, vars.input),
    onSuccess: () => {
      void invalidateMembers(qc, projectId);
    },
  });
};

export const useRemoveMember = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation<RemoveMemberResponse, Error, string>({
    mutationFn: (memberId: string) => removeProjectMember(projectId, memberId),
    onSuccess: () => {
      void invalidateMembers(qc, projectId);
      // Tasks may have been auto-unassigned → invalidate task lists too.
      void qc.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });
};
