import bcrypt from 'bcrypt';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { taskService } from '../../task/task.service';
import { commentService } from '../../comment/comment.service';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;
const future = (days = 7) => new Date(Date.now() + days * 86_400_000);
const tag = 'notif-trig';

maybe('notification triggers (task.assigned + comment.created)', () => {
  let actorId: string;
  let aId: string;
  let bId: string;
  let creatorId: string;
  let projectId: string;

  beforeAll(async () => {
    await prisma.notification.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });

    actorId = (await prisma.user.create({
      data: { email: `${tag}-actor@t.local`, name: 'Actor', passwordHash: await bcrypt.hash('x', 4), role: 'admin' },
    })).id;
    aId = (await prisma.user.create({
      data: { email: `${tag}-a@t.local`, name: 'A', passwordHash: await bcrypt.hash('x', 4), role: 'team_member' },
    })).id;
    bId = (await prisma.user.create({
      data: { email: `${tag}-b@t.local`, name: 'B', passwordHash: await bcrypt.hash('x', 4), role: 'team_member' },
    })).id;
    creatorId = (await prisma.user.create({
      data: { email: `${tag}-creator@t.local`, name: 'Creator', passwordHash: await bcrypt.hash('x', 4), role: 'team_member' },
    })).id;

    projectId = (await prisma.project.create({
      data: { name: `${tag} Proj`, deadline: future(30), status: 'active', createdBy: actorId },
    })).id;
    // Membership for assignees
    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: aId, role: 'member' },
        { projectId, userId: bId, role: 'member' },
        { projectId, userId: creatorId, role: 'member' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.task.deleteMany({ where: { projectId } });
    await prisma.projectMember.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: { in: [actorId, aId, bId, creatorId] } } });
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.task.deleteMany({ where: { projectId } });
  });

  const createTask = async (assigneeId: string | null = null, creator = actorId) => {
    return taskService.create(
      {
        projectId,
        title: `${tag} ${Math.random()}`,
        dueDate: future(),
        status: TaskStatus.todo,
        priority: TaskPriority.medium,
        assigneeIds: assigneeId ? [assigneeId] : [],
      },
      creator,
    );
  };

  it('creating a task with assignee enqueues task.assigned for assignee', async () => {
    const t = await createTask(aId, actorId);
    const notifs = await prisma.notification.findMany({ where: { entityId: t.id, type: 'task.assigned' } });
    expect(notifs.length).toBe(1);
    expect(notifs[0].recipientId).toBe(aId);
    expect(notifs[0].actorId).toBe(actorId);
  });

  it('no notif when assignee == actor (self-assign)', async () => {
    const t = await createTask(actorId, actorId);
    const notifs = await prisma.notification.findMany({ where: { entityId: t.id, type: 'task.assigned' } });
    expect(notifs.length).toBe(0);
  });

  it('reassigning A → B enqueues for B only', async () => {
    const t = await createTask(aId, actorId);
    await prisma.notification.deleteMany({});
    await taskService.replaceAssignees(t.id, [bId], actorId, { id: actorId, role: 'admin' });
    const notifs = await prisma.notification.findMany({ where: { entityId: t.id, type: 'task.assigned' } });
    expect(notifs.length).toBe(1);
    expect(notifs[0].recipientId).toBe(bId);
  });

  it('new comment notifies task assignee + creator, deduped, excludes actor', async () => {
    const t = await taskService.create(
      {
        projectId,
        title: `${tag} comment-trigger`,
        dueDate: future(),
        status: TaskStatus.todo,
        priority: TaskPriority.medium,
        assigneeIds: [aId],
      },
      creatorId, // creator = creatorId, assignee = aId
    );
    await prisma.notification.deleteMany({}); // clear assignment notif

    // bId comments → notifies assignee (aId) and creator (creatorId), skips actor (bId)
    await commentService.create(t.id, bId, `${tag} hello`);
    const notifs = await prisma.notification.findMany({ where: { type: 'comment.created' } });
    const recipients = notifs.map((n) => n.recipientId).sort();
    expect(recipients).toEqual([aId, creatorId].sort());

    // creator comments on own task → assignee notified once, creator skipped
    await prisma.notification.deleteMany({});
    await commentService.create(t.id, creatorId, `${tag} creator speaks`);
    const notifs2 = await prisma.notification.findMany({ where: { type: 'comment.created' } });
    expect(notifs2.length).toBe(1);
    expect(notifs2[0].recipientId).toBe(aId);
  });

  it('comment by assignee == creator (assignee is the creator) does not double-notify', async () => {
    const t = await taskService.create(
      {
        projectId,
        title: `${tag} same`,
        dueDate: future(),
        status: TaskStatus.todo,
        priority: TaskPriority.medium,
        assigneeIds: [creatorId],
      },
      creatorId,
    );
    await prisma.notification.deleteMany({});
    await commentService.create(t.id, bId, `${tag} hi`);
    const notifs = await prisma.notification.findMany({ where: { type: 'comment.created' } });
    expect(notifs.length).toBe(1);
    expect(notifs[0].recipientId).toBe(creatorId);
  });

  it('unassigning task via empty replace does not enqueue task.assigned', async () => {
    const t = await createTask(aId, actorId);
    await prisma.notification.deleteMany({});
    await taskService.replaceAssignees(t.id, [], actorId, { id: actorId, role: 'admin' });
    const notifs = await prisma.notification.findMany({ where: { entityId: t.id, type: 'task.assigned' } });
    expect(notifs.length).toBe(0);
  });

  describe('multi-assignee fan-out', () => {
    it('status change fans out task.status_changed to all assignees except actor', async () => {
      const t = await taskService.create(
        {
          projectId,
          title: `${tag} fanout-${Math.random()}`,
          dueDate: future(),
          status: TaskStatus.todo,
          priority: TaskPriority.medium,
          assigneeIds: [aId, bId, creatorId],
        },
        actorId,
      );
      await prisma.notification.deleteMany({});
      await taskService.update(
        t.id,
        { status: TaskStatus.in_progress },
        actorId,
        { id: actorId, role: 'admin' },
      );
      const notifs = await prisma.notification.findMany({
        where: { entityId: t.id, type: 'task.status_changed' },
      });
      const recipients = notifs.map((n) => n.recipientId).sort();
      expect(recipients).toEqual([aId, bId, creatorId].sort());
    });

    it('status change by an assignee skips that assignee', async () => {
      const t = await taskService.create(
        {
          projectId,
          title: `${tag} skip-self-${Math.random()}`,
          dueDate: future(),
          status: TaskStatus.todo,
          priority: TaskPriority.medium,
          assigneeIds: [aId, bId],
        },
        actorId,
      );
      await prisma.notification.deleteMany({});
      // aId updates status — should notify bId only, not aId
      await taskService.update(
        t.id,
        { status: TaskStatus.in_progress },
        aId,
        { id: aId, role: 'team_member' },
      );
      const notifs = await prisma.notification.findMany({
        where: { entityId: t.id, type: 'task.status_changed' },
      });
      expect(notifs.map((n) => n.recipientId)).toEqual([bId]);
    });

    it('addAssignee notifies the added user', async () => {
      const t = await taskService.create(
        {
          projectId,
          title: `${tag} add-${Math.random()}`,
          dueDate: future(),
          status: TaskStatus.todo,
          priority: TaskPriority.medium,
          assigneeIds: [],
        },
        actorId,
      );
      await prisma.notification.deleteMany({});
      await taskService.addAssignee(t.id, aId, actorId, { id: actorId, role: 'admin' });
      const notifs = await prisma.notification.findMany({
        where: { entityId: t.id, type: 'task.assigned' },
      });
      expect(notifs.map((n) => n.recipientId)).toEqual([aId]);
    });

    it('removeAssignee notifies the removed user', async () => {
      const t = await taskService.create(
        {
          projectId,
          title: `${tag} remove-${Math.random()}`,
          dueDate: future(),
          status: TaskStatus.todo,
          priority: TaskPriority.medium,
          assigneeIds: [aId, bId],
        },
        actorId,
      );
      await prisma.notification.deleteMany({});
      await taskService.removeAssignee(t.id, aId, actorId, { id: actorId, role: 'admin' });
      const notifs = await prisma.notification.findMany({
        where: { entityId: t.id, type: 'task.unassigned' },
      });
      expect(notifs.map((n) => n.recipientId)).toEqual([aId]);
    });
  });

  describe('comment.mention fan-out (backlog #B8)', () => {
    it('mentioning a project member suppresses comment.created for that user', async () => {
      const t = await taskService.create(
        {
          projectId,
          title: `${tag} mention-${Math.random()}`,
          dueDate: future(),
          status: TaskStatus.todo,
          priority: TaskPriority.medium,
          assigneeIds: [aId, bId],
        },
        creatorId,
      );
      await prisma.notification.deleteMany({});
      // creatorId comments and mentions aId. bId still gets comment.created.
      await commentService.create(t.id, creatorId, `Heads up @[A](${aId}) please review.`);
      const mentioned = await prisma.notification.findMany({
        where: { entityId: { not: undefined }, type: 'comment.mention' },
      });
      const created = await prisma.notification.findMany({
        where: { entityId: { not: undefined }, type: 'comment.created' },
      });
      expect(mentioned.map((n) => n.recipientId)).toEqual([aId]);
      expect(created.map((n) => n.recipientId).sort()).toEqual([bId].sort());
    });

    it('mention of a non-project-member is silently dropped, no notification rows', async () => {
      const t = await taskService.create(
        {
          projectId,
          title: `${tag} mention-nm-${Math.random()}`,
          dueDate: future(),
          status: TaskStatus.todo,
          priority: TaskPriority.medium,
          assigneeIds: [aId],
        },
        creatorId,
      );
      await prisma.notification.deleteMany({});
      // Use a syntactically-valid UUID that is NOT any seeded user — silent drop.
      const ghostId = '00000000-0000-4000-8000-000000000000';
      await commentService.create(t.id, creatorId, `Ping @[Ghost](${ghostId}) for context.`);
      const mentioned = await prisma.notification.findMany({ where: { type: 'comment.mention' } });
      expect(mentioned.length).toBe(0);
      // comment.created still fires for the assignee aId (creatorId is actor → self-skip).
      const created = await prisma.notification.findMany({ where: { type: 'comment.created' } });
      expect(created.map((n) => n.recipientId)).toEqual([aId]);
    });

    it('self-mention enqueues no comment.mention (actor self-skip)', async () => {
      const t = await taskService.create(
        {
          projectId,
          title: `${tag} mention-self-${Math.random()}`,
          dueDate: future(),
          status: TaskStatus.todo,
          priority: TaskPriority.medium,
          assigneeIds: [aId],
        },
        creatorId,
      );
      await prisma.notification.deleteMany({});
      await commentService.create(t.id, creatorId, `Note to self @[Me](${creatorId}).`);
      const mentioned = await prisma.notification.findMany({ where: { type: 'comment.mention' } });
      expect(mentioned.length).toBe(0);
    });

    it('rejects bodies with more than MAX_MENTIONS_PER_COMMENT mentions (422)', async () => {
      const t = await taskService.create(
        {
          projectId,
          title: `${tag} mention-cap-${Math.random()}`,
          dueDate: future(),
          status: TaskStatus.todo,
          priority: TaskPriority.medium,
          assigneeIds: [aId],
        },
        creatorId,
      );
      await prisma.notification.deleteMany({});
      const ids = Array.from({ length: 21 }, (_, i) =>
        `${i.toString(16).padStart(8, '0')}-aaaa-4bbb-9ccc-dddddddddddd`,
      );
      const body = ids.map((id, i) => `@[U${i}](${id})`).join(' ');
      await expect(commentService.create(t.id, creatorId, body)).rejects.toMatchObject({
        code: 'TOO_MANY_MENTIONS',
        statusCode: 422,
      });
      const anyComment = await prisma.comment.findMany({ where: { taskId: t.id } });
      expect(anyComment.length).toBe(0);
    });
  });
});
