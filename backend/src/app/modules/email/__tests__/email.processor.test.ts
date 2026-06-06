import { processEmailJob, type EmailProcessorDeps } from '../email.processor';
import { StubEmailProvider } from '../email.provider';
import type { EmailJobData } from '../email.queue';

type UserRow = {
  id: string;
  email: string;
  name: string;
  emailNotifications: boolean;
};

const makePrismaStub = (user: UserRow | null): EmailProcessorDeps['prisma'] =>
  ({
    user: {
      findUnique: jest.fn(async () => user),
    },
  }) as unknown as EmailProcessorDeps['prisma'];

const baseJob = (overrides: Partial<EmailJobData> = {}): EmailJobData => ({
  recipientId: 'u-1',
  recipientEmail: 'placeholder@example.com',
  recipientName: 'Riley',
  actorName: 'Alex',
  type: 'comment.mention',
  payload: { taskTitle: 'Ship it', commentExcerpt: 'hey @riley' },
  ...overrides,
});

describe('processEmailJob', () => {
  it('sends when user exists + emailNotifications=true', async () => {
    const prisma = makePrismaStub({
      id: 'u-1',
      email: 'riley@example.com',
      name: 'Riley',
      emailNotifications: true,
    });
    const provider = new StubEmailProvider();
    const out = await processEmailJob(baseJob(), { prisma, provider });
    expect(out.status).toBe('sent');
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].to).toBe('riley@example.com');
    expect(provider.sent[0].subject).toContain('mentioned you');
  });

  it('skips when user not found (account deleted between enqueue + drain)', async () => {
    const prisma = makePrismaStub(null);
    const provider = new StubEmailProvider();
    const out = await processEmailJob(baseJob(), { prisma, provider });
    expect(out.status).toBe('skipped-user-not-found');
    expect(provider.sent).toHaveLength(0);
  });

  it('hard-gates on emailNotifications=false (opt-out)', async () => {
    const prisma = makePrismaStub({
      id: 'u-1',
      email: 'riley@example.com',
      name: 'Riley',
      emailNotifications: false,
    });
    const provider = new StubEmailProvider();
    const out = await processEmailJob(baseJob(), { prisma, provider });
    expect(out.status).toBe('skipped-opted-out');
    // The critical assertion likely_misfire #3 guards: provider must NEVER
    // be called for an opted-out user.
    expect(provider.sent).toHaveLength(0);
  });

  it('uses the user.email from DB, not the job payload (defense in depth)', async () => {
    const prisma = makePrismaStub({
      id: 'u-1',
      email: 'truth@example.com',
      name: 'Riley',
      emailNotifications: true,
    });
    const provider = new StubEmailProvider();
    await processEmailJob(
      baseJob({ recipientEmail: 'stale-from-cache@example.com' }),
      { prisma, provider },
    );
    expect(provider.sent[0].to).toBe('truth@example.com');
  });

  it('throws when provider.send returns ok:false (BullMQ retry hook)', async () => {
    const prisma = makePrismaStub({
      id: 'u-1',
      email: 'riley@example.com',
      name: 'Riley',
      emailNotifications: true,
    });
    const provider = {
      name: 'stub' as const,
      send: jest.fn(async () => ({
        ok: false as const,
        provider: 'stub',
        error: 'simulated',
      })),
    };
    await expect(processEmailJob(baseJob(), { prisma, provider })).rejects.toThrow(
      /provider stub send failed/,
    );
  });

  it('returns providerMessageId on success', async () => {
    const prisma = makePrismaStub({
      id: 'u-1',
      email: 'riley@example.com',
      name: 'Riley',
      emailNotifications: true,
    });
    const provider = {
      name: 'stub' as const,
      send: jest.fn(async () => ({
        ok: true as const,
        provider: 'stub',
        id: 'msg-42',
      })),
    };
    const out = await processEmailJob(baseJob(), { prisma, provider });
    expect(out).toEqual({ status: 'sent', providerMessageId: 'msg-42' });
  });

  it('processes task.assigned correctly', async () => {
    const prisma = makePrismaStub({
      id: 'u-1',
      email: 'riley@example.com',
      name: 'Riley',
      emailNotifications: true,
    });
    const provider = new StubEmailProvider();
    await processEmailJob(
      baseJob({ type: 'task.assigned', payload: { taskTitle: 'Ship it' } }),
      { prisma, provider },
    );
    expect(provider.sent[0].subject).toContain('assigned you to');
  });

  it('processes task.status_changed correctly', async () => {
    const prisma = makePrismaStub({
      id: 'u-1',
      email: 'riley@example.com',
      name: 'Riley',
      emailNotifications: true,
    });
    const provider = new StubEmailProvider();
    await processEmailJob(
      baseJob({
        type: 'task.status_changed',
        payload: { taskTitle: 'Ship it', status: 'done' },
      }),
      { prisma, provider },
    );
    expect(provider.sent[0].subject).toBe('"Ship it" is now done');
  });
});
