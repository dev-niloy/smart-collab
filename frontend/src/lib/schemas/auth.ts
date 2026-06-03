import { z } from 'zod';

export const ROLES = ['admin', 'project_manager', 'team_member'] as const;
export type Role = (typeof ROLES)[number];

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().min(1, 'Name is required').max(120),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const demoLoginSchema = z.object({
  role: z.enum(ROLES),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type DemoLoginInput = z.infer<typeof demoLoginSchema>;
