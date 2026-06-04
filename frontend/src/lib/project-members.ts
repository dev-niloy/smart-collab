import { apiGet, apiPost, apiPatch, apiDelete } from './api';
import type {
  AddMemberInput,
  UpdateMemberRoleInput,
  MembersListResponse,
  AssignableListResponse,
  MemberResponse,
  RemoveMemberResponse,
} from './schemas/project-member';

export const listProjectMembers = (projectId: string) =>
  apiGet<MembersListResponse>(`/api/v1/projects/${projectId}/members`).then((r) => r.data);

export const listAssignableMembers = (projectId: string) =>
  apiGet<AssignableListResponse>(`/api/v1/projects/${projectId}/members/assignable`).then(
    (r) => r.data,
  );

export const addProjectMember = (projectId: string, input: AddMemberInput) =>
  apiPost<MemberResponse>(`/api/v1/projects/${projectId}/members`, input).then((r) => r.member);

export const updateProjectMemberRole = (
  projectId: string,
  memberId: string,
  input: UpdateMemberRoleInput,
) =>
  apiPatch<MemberResponse>(
    `/api/v1/projects/${projectId}/members/${memberId}`,
    input,
  ).then((r) => r.member);

export const removeProjectMember = (projectId: string, memberId: string) =>
  apiDelete<RemoveMemberResponse>(`/api/v1/projects/${projectId}/members/${memberId}`);
