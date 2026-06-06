// BullMQ processor for the 'email' queue. Pulled in by backend/src/worker.ts.
//
// Responsibilities (in strict order):
//   1. Resolve the recipient's User row — short-circuit if the user no longer
//      exists (account deleted between enqueue + drain).
//   2. Enforce the per-user opt-out (User.emailNotifications). This is the
//      single place that gate must live (likely_misfire #3 in the board).
//   3. Render the per-type template.
//   4. Call the configured provider via the factory.
//   5. Surface failures by throwing — BullMQ handles retry / backoff.

import type { Job } from 'bullmq';
import { prisma as defaultPrisma } from '../../../config/prisma';
import { getEmailProvider } from './email.factory';
import type { EmailProvider } from './email.provider';
import type { EmailJobData } from './email.queue';
import { renderEmail } from './email.templates';

type Prisma = typeof defaultPrisma;

export type EmailProcessorDeps = {
  prisma?: Prisma;
  provider?: EmailProvider;
};

export type EmailProcessorResult =
  | { status: 'sent'; providerMessageId?: string }
  | { status: 'skipped-user-not-found' }
  | { status: 'skipped-opted-out' };

// The worker entrypoint expects a default-exported processor that takes a
// BullMQ Job. We export both the bound default and the dep-injected core so
// tests can drive the logic without a real Redis or Prisma.
export const processEmailJob = async (
  data: EmailJobData,
  deps: EmailProcessorDeps = {},
): Promise<EmailProcessorResult> => {
  const prisma = deps.prisma ?? defaultPrisma;
  const provider = deps.provider ?? getEmailProvider();

  const user = await prisma.user.findUnique({
    where: { id: data.recipientId },
    select: { id: true, email: true, name: true, emailNotifications: true },
  });

  if (!user) {
    return { status: 'skipped-user-not-found' };
  }

  if (!user.emailNotifications) {
    // Hard gate — never call the provider for an opted-out user. This is the
    // assertion likely_misfire #3 specifically guards against.
    return { status: 'skipped-opted-out' };
  }

  const rendered = renderEmail(data);
  const result = await provider.send({
    to: user.email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });

  if (!result.ok) {
    // Throwing surfaces the failure to BullMQ for retry/backoff. The job
    // payload + attemptsMade are visible in the worker's `failed` handler.
    throw new Error(`provider ${result.provider} send failed: ${result.error ?? 'unknown'}`);
  }

  return { status: 'sent', providerMessageId: result.id };
};

export const emailProcessor = async (job: Job<EmailJobData>): Promise<EmailProcessorResult> => {
  return processEmailJob(job.data);
};
