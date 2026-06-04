import { z } from 'zod';
import { ProjectRole } from '@prisma/client';

const uuidField = z.string().uuid('Invalid id');
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email')
  .max(254);
const roleField = z.nativeEnum(ProjectRole);

export const addMemberSchema = z.object({
  email: emailField,
  role: roleField.default(ProjectRole.member),
});

export const updateMemberRoleSchema = z.object({
  role: roleField,
});

export const memberIdParamSchema = z.object({
  id: uuidField,
  memberId: uuidField,
});

export const projectIdParamSchema = z.object({
  id: uuidField,
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type MemberIdParam = z.infer<typeof memberIdParamSchema>;
