import { apiGet, apiPost, apiDelete } from './api';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type InvitationRole = 'pm' | 'member';

export type ProjectInvitation = {
  id: string;
  projectId: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptUrl: string | null;
  createdBy: { id: string; name: string; email: string };
};

export type InvitationLookup = {
  id: string;
  email: string;
  role: InvitationRole;
  status: InvitationStatus;
  expiresAt: string;
  project: { id: string; name: string; description: string | null };
  inviter: { name: string; email: string };
};

type ListResp = { data: ProjectInvitation[] };
type OneResp = { data: ProjectInvitation };
type LookupResp = { data: InvitationLookup };
type AcceptResp = { data: { projectId: string } };

export const listProjectInvitations = (projectId: string): Promise<ProjectInvitation[]> =>
  apiGet<ListResp>(`/api/v1/projects/${projectId}/invitations`).then((r) => r.data);

export const createProjectInvitation = (
  projectId: string,
  body: { email: string; role: InvitationRole },
): Promise<ProjectInvitation> =>
  apiPost<OneResp>(`/api/v1/projects/${projectId}/invitations`, body).then((r) => r.data);

export const revokeProjectInvitation = (
  projectId: string,
  invitationId: string,
): Promise<ProjectInvitation> =>
  apiDelete<OneResp>(`/api/v1/projects/${projectId}/invitations/${invitationId}`).then(
    (r) => r.data,
  );

export const lookupInvitation = (token: string): Promise<InvitationLookup> =>
  apiGet<LookupResp>(`/api/v1/invitations/${encodeURIComponent(token)}`).then((r) => r.data);

export const acceptInvitation = (token: string): Promise<{ projectId: string }> =>
  apiPost<AcceptResp>(`/api/v1/invitations/${encodeURIComponent(token)}/accept`).then(
    (r) => r.data,
  );
