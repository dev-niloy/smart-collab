import { z } from 'zod';

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email').max(254),
  role: z.enum(['pm', 'member']).default('member'),
});

export const projectIdParamSchema = z.object({
  id: z.string().uuid('Invalid project id'),
});

export const invitationIdParamSchema = z.object({
  id: z.string().uuid('Invalid project id'),
  invitationId: z.string().uuid('Invalid invitation id'),
});

export const tokenParamSchema = z.object({
  token: z.string().trim().min(8).max(256),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
