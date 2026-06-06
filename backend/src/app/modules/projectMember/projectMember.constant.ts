import { ProjectRole } from '@prisma/client';

export const PROJECT_ROLES: ProjectRole[] = [ProjectRole.pm, ProjectRole.member];

// Error codes — surfaced as ApiError.code in API responses.
export const ERR_USER_NOT_FOUND = 'USER_NOT_FOUND';
export const ERR_ALREADY_MEMBER = 'ALREADY_MEMBER';
export const ERR_MEMBER_NOT_FOUND = 'MEMBER_NOT_FOUND';
export const ERR_CANNOT_REMOVE_LAST_PM = 'CANNOT_REMOVE_LAST_PM';
export const ERR_ASSIGNEE_NOT_PROJECT_MEMBER = 'ASSIGNEE_NOT_PROJECT_MEMBER';
export const ERR_FORBIDDEN_PROJECT_ROLE = 'FORBIDDEN_PROJECT_ROLE';

// User-facing messages.
export const USER_NOT_FOUND_MESSAGE = 'No user found with that email.';
export const ALREADY_MEMBER_MESSAGE = 'User is already a member of this project.';
export const MEMBER_NOT_FOUND_MESSAGE = 'Member not found.';
export const CANNOT_REMOVE_LAST_PM_MESSAGE =
  'Cannot remove the last project manager while tasks exist. Promote another member first.';
export const ASSIGNEE_NOT_PROJECT_MEMBER_MESSAGE =
  'Assignee must be a member of this project.';
export const FORBIDDEN_PROJECT_ROLE_MESSAGE = 'You do not have permission for this project action.';
