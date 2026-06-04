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

  const createTask = async (assignedTo: string | null = null, creator = actorId) => {
    return taskService.create(
      {
        projectId,
        title: `${tag} ${Math.random()}`,
        dueDate: future(),
        status: TaskStatus.todo,
        priority: TaskPriority.medium,
        assignedTo,
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
    await prisma.notification.deleteMany({}); // clear initial notif
    await taskService.update(t.id, { assignedTo: bId }, actorId);
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
        assignedTo: aId,
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
        assignedTo: creatorId,
      },
      creatorId,
    );
    await prisma.notification.deleteMany({});
    await commentService.create(t.id, bId, `${tag} hi`);
    const notifs = await prisma.notification.findMany({ where: { type: 'comment.created' } });
    expect(notifs.length).toBe(1);
    expect(notifs[0].recipientId).toBe(creatorId);
  });

  it('unassigning task (assignee → null) does not enqueue', async () => {
    const t = await createTask(aId, actorId);
    await prisma.notification.deleteMany({});
    await taskService.update(t.id, { assignedTo: null }, actorId);
    const notifs = await prisma.notification.findMany({ where: { entityId: t.id, type: 'task.assigned' } });
    expect(notifs.length).toBe(0);
  });
});
