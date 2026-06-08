'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acceptInvitation,
  createProjectInvitation,
  listProjectInvitations,
  lookupInvitation,
  revokeProjectInvitation,
  type InvitationLookup,
  type InvitationRole,
  type ProjectInvitation,
} from '@/lib/invitations';
import { projectKey } from './useProjects';

const invitationsKey = (projectId: string) =>
  ['projectInvitations', projectId] as const;

export const useProjectInvitations = (projectId: string | undefined) =>
  useQuery<ProjectInvitation[]>({
    queryKey: invitationsKey(projectId ?? ''),
    queryFn: () => listProjectInvitations(projectId as string),
    enabled: !!projectId,
    staleTime: 10_000,
  });

export const useCreateInvitation = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: InvitationRole }) =>
      createProjectInvitation(projectId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invitationsKey(projectId) });
    },
  });
};

export const useRevokeInvitation = (projectId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => revokeProjectInvitation(projectId, invitationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invitationsKey(projectId) });
    },
  });
};

export const useInvitationLookup = (token: string | undefined) =>
  useQuery<InvitationLookup>({
    queryKey: ['invitationLookup', token ?? ''] as const,
    queryFn: () => lookupInvitation(token as string),
    enabled: !!token,
    staleTime: 5_000,
    retry: false,
  });

export const useAcceptInvitation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => acceptInvitation(token),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: projectKey(data.projectId) });
      qc.invalidateQueries({ queryKey: ['projectMembers'] });
    },
  });
};
