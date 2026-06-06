import { z } from 'zod';
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH, PASSWORD_MIN_LENGTH } from './user.constant';

const nameField = z.string().trim().min(NAME_MIN_LENGTH, 'Name is required').max(NAME_MAX_LENGTH);
const emailField = z.string().trim().email('Invalid email').toLowerCase();
const passwordField = z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);

export const updateProfileSchema = z
  .object({
    name: nameField.optional(),
    email: emailField.optional(),
  })
  .refine((v) => v.name !== undefined || v.email !== undefined, {
    message: 'At least one of name or email must be provided',
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordField,
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
