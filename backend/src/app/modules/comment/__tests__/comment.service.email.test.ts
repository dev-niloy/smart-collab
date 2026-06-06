// Unit tests for the email fan-out helper exercised by comment.service.create.
// We test the helper itself rather than driving comment.service end-to-end
// because (a) the comment.service path is already covered by its existing
// integration tests, and (b) it is the helper that owns the actor-skip + opt-
// out filtering + payload shape that comment.service relies on.

import { fanoutEmailJobs, type FanoutDeps } from '../../email/email.enqueue';
import type { enqueueEmailJob } from '../../email/email.queue';

type UserRow = { id: string; email: string; name: string };
type EnqueueArg = Parameters<typeof enqueueEmailJob>[0];

const makeEnqueueSpy = () =>
  jest.fn<Promise<void>, [EnqueueArg]>(async () => undefined);

const makePrismaStub = (users: UserRow[]): FanoutDeps['prisma'] =>
  ({
    user: {
      findMany: jest.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        users.filter((u) => where.id.in.includes(u.id)),
      ),
    },
  }) as unknown as FanoutDeps['prisma'];

describe('fanoutEmailJobs (comment.* wiring)', () => {
  const payload = {
    taskTitle: 'Ship docs',
    taskId: 't-1',
    projectId: 'p-1',
    commentId: 'c-1',
    commentExcerpt: 'hey @u2 check this',
  };

  it('enqueues a comment.mention job per opted-in recipient', async () => {
    const enqueue = makeEnqueueSpy();
    const prisma = makePrismaStub([
      { id: 'u-2', email: 'u2@x.com', name: 'Two' },
      { id: 'u-3', email: 'u3@x.com', name: 'Three' },
    ]);
    const out = await fanoutEmailJobs(
      {
        recipientIds: ['u-2', 'u-3'],
        actorId: 'u-1',
        actorName: 'One',
        type: 'comment.mention',
        payload,
      },
      { prisma, enqueue },
    );
    expect(out).toEqual({ considered: 2, enqueued: 2 });
    expect(enqueue).toHaveBeenCalledTimes(2);
    const firstCall = enqueue.mock.calls[0][0];
    expect(firstCall.name).toBe('comment.mention');
    expect(firstCall.data.actorName).toBe('One');
    expect(firstCall.data.payload).toEqual(payload);
  });

  it('skips the actor (no self-mail) even if their id is in recipientIds', async () => {
    const enqueue = makeEnqueueSpy();
    const prisma = makePrismaStub([{ id: 'u-2', email: 'u2@x.com', name: 'Two' }]);
    await fanoutEmailJobs(
      {
        recipientIds: ['u-1', 'u-2'],
        actorId: 'u-1',
        actorName: 'One',
        type: 'comment.created',
        payload,
      },
      { prisma, enqueue },
    );
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][0].data.recipientId).toBe('u-2');
  });

  it('drops opted-out users at the DB query (prisma filter on emailNotifications=true)', async () => {
    // Stub only returns opted-in users — simulates Prisma where clause filter.
    const enqueue = makeEnqueueSpy();
    const prisma = makePrismaStub([
      { id: 'u-2', email: 'u2@x.com', name: 'Two' },
      // u-3 omitted intentionally → simulates emailNotifications=false filter
    ]);
    const out = await fanoutEmailJobs(
      {
        recipientIds: ['u-2', 'u-3'],
        actorId: 'u-1',
        actorName: 'One',
        type: 'comment.created',
        payload,
      },
      { prisma, enqueue },
    );
    expect(out).toEqual({ considered: 2, enqueued: 1 });
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][0].data.recipientId).toBe('u-2');
  });

  it('returns early with enqueued=0 when only the actor is in recipientIds', async () => {
    const enqueue = makeEnqueueSpy();
    const prisma = makePrismaStub([]);
    const out = await fanoutEmailJobs(
      {
        recipientIds: ['u-1'],
        actorId: 'u-1',
        actorName: 'One',
        type: 'comment.created',
        payload,
      },
      { prisma, enqueue },
    );
    expect(out).toEqual({ considered: 0, enqueued: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('returns early when recipientIds is empty', async () => {
    const enqueue = makeEnqueueSpy();
    const prisma = makePrismaStub([]);
    const out = await fanoutEmailJobs(
      {
        recipientIds: [],
        actorId: 'u-1',
        actorName: 'One',
        type: 'comment.mention',
        payload,
      },
      { prisma, enqueue },
    );
    expect(out).toEqual({ considered: 0, enqueued: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('passes the resolved DB email + name into the job payload (defense in depth)', async () => {
    const enqueue = makeEnqueueSpy();
    const prisma = makePrismaStub([
      { id: 'u-2', email: 'real@db.com', name: 'Real Name' },
    ]);
    await fanoutEmailJobs(
      {
        recipientIds: ['u-2'],
        actorId: 'u-1',
        actorName: null,
        type: 'comment.mention',
        payload,
      },
      { prisma, enqueue },
    );
    const data = enqueue.mock.calls[0][0].data;
    expect(data.recipientEmail).toBe('real@db.com');
    expect(data.recipientName).toBe('Real Name');
    expect(data.actorName).toBeNull();
  });
});
