import { z } from 'zod';

export const PROJECT_ROLES = ['pm', 'member'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email')
  .max(254);

const roleField = z.enum(PROJECT_ROLES);
const uuidField = z.string().uuid('Invalid id');

export const addMemberSchema = z.object({
  email: emailField,
  role: roleField.default('member'),
});

export const updateMemberRoleSchema = z.object({
  role: roleField,
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export type MemberUser = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'project_manager' | 'team_member';
};

export type Workload = {
  todo: number;
  in_progress: number;
  completed: number;
  due_soon: number;
};

export type ProjectMember = {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  addedAt: string;
  addedById: string | null;
  user: MemberUser;
  workload: Workload;
};

export type AssignableMember = {
  id: string;
  email: string;
  name: string;
  role: MemberUser['role'];
  projectRole: ProjectRole | 'admin';
};

export type MembersListResponse = { data: ProjectMember[] };
export type AssignableListResponse = { data: AssignableMember[] };
export type MemberResponse = { member: ProjectMember };
export type RemoveMemberResponse = { removedMemberId: string; tasksUnassigned: number };

// Error codes mirrored from backend projectMember.constant.ts
export const ERR_USER_NOT_FOUND = 'USER_NOT_FOUND';
export const ERR_ALREADY_MEMBER = 'ALREADY_MEMBER';
export const ERR_MEMBER_NOT_FOUND = 'MEMBER_NOT_FOUND';
export const ERR_CANNOT_REMOVE_LAST_PM = 'CANNOT_REMOVE_LAST_PM';
export const ERR_FORBIDDEN_PROJECT_ROLE = 'FORBIDDEN_PROJECT_ROLE';
export const _ = { uuidField };
