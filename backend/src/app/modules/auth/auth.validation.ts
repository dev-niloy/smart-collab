import { z } from 'zod';
import { ROLES } from './auth.constant';

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email');

const passwordField = z.string().min(8, 'Password must be at least 8 characters');

export const signupSchema = z.object({
  email: emailField,
  password: passwordField,
  name: z.string().trim().min(1, 'Name is required').max(120),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

export const demoLoginSchema = z.object({
  role: z.enum(ROLES as [string, ...string[]]),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DemoLoginInput = z.infer<typeof demoLoginSchema>;
