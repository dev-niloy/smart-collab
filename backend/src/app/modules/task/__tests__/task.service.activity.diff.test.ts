import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { taskService } from '../task.service';

const TEST_EMAIL = 'task-act-diff@test.local';
const ASSIGNEE_EMAIL = 'task-act-assignee@test.local';
const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 7) => new Date(Date.now() + days * 86_400_000);

maybe('task.service status/assignee activity diffs', () => {
  let actorId: string;
  let assigneeId: string;
  let projectId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [TEST_EMAIL, ASSIGNEE_EMAIL] } } });
    const u = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Diff Actor',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'admin',
      },
    });
    actorId = u.id;
    const a = await prisma.user.create({
      data: {
        email: ASSIGNEE_EMAIL,
        name: 'Diff Assignee',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'team_member',
      },
    });
    assigneeId = a.id;
  });

  beforeEach(async () => {
    await prisma.activityLog.deleteMany({ where: { actorId } });
    await prisma.task.deleteMany({ where: { project: { name: { startsWith: 'TaskDiff' } } } });
    await prisma.project.deleteMany({ where: { name: { startsWith: 'TaskDiff' } } });
    const p = await prisma.project.create({
      data: { name: 'TaskDiff Proj', deadline: future(30), status: 'active', createdBy: actorId },
    });
    projectId = p.id;
    await prisma.projectMember.create({
      data: { projectId, userId: assigneeId, role: 'member', addedById: actorId },
    });
    // clear creator emits from activity
    await prisma.activityLog.deleteMany({ where: { projectId, action: 'task.created' } });
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { actorId } });
    await prisma.task.deleteMany({ where: { project: { name: { startsWith: 'TaskDiff' } } } });
    await prisma.project.deleteMany({ where: { name: { startsWith: 'TaskDiff' } } });
    await prisma.user.deleteMany({ where: { id: { in: [actorId, assigneeId] } } });
    await disconnectPrisma();
  });

  it('emits task.status_changed when status changes', async () => {
    const t = await taskService.create(
      { projectId, title: 'S1', dueDate: future(5), status: 'todo', priority: 'medium', assignedTo: null } as any,
      actorId,
    );
    await taskService.update(t.id, { status: 'in_progress' } as any, actorId);
    const log = await prisma.activityLog.findFirst({
      where: { action: 'task.status_changed', entityId: t.id },
    });
    expect(log).not.toBeNull();
    const meta = log!.meta as Record<string, unknown>;
    expect(meta.from).toBe('todo');
    expect(meta.to).toBe('in_progress');
  });

  it('emits task.assigned when assignee changes', async () => {
    const t = await taskService.create(
      { projectId, title: 'A1', dueDate: future(5), status: 'todo', priority: 'medium', assignedTo: null } as any,
      actorId,
    );
    await taskService.update(t.id, { assignedTo: assigneeId } as any, actorId);
    const log = await prisma.activityLog.findFirst({
      where: { action: 'task.assigned', entityId: t.id },
    });
    expect(log).not.toBeNull();
    const meta = log!.meta as Record<string, unknown>;
    expect(meta.to).toBe(assigneeId);
  });

  it('does not emit status_changed when status unchanged', async () => {
    const t = await taskService.create(
      { projectId, title: 'S2', dueDate: future(5), status: 'todo', priority: 'medium', assignedTo: null } as any,
      actorId,
    );
    await taskService.update(t.id, { title: 'S2 renamed' } as any, actorId);
    const count = await prisma.activityLog.count({
      where: { action: 'task.status_changed', entityId: t.id },
    });
    expect(count).toBe(0);
  });

  it('does not emit assigned when assignee unchanged', async () => {
    const t = await taskService.create(
      { projectId, title: 'A2', dueDate: future(5), status: 'todo', priority: 'medium', assignedTo: assigneeId } as any,
      actorId,
    );
    await taskService.update(t.id, { assignedTo: assigneeId } as any, actorId);
    const count = await prisma.activityLog.count({
      where: { action: 'task.assigned', entityId: t.id },
    });
    expect(count).toBe(0);
  });

  it('emits both status_changed and assigned in single update call', async () => {
    const t = await taskService.create(
      { projectId, title: 'Both', dueDate: future(5), status: 'todo', priority: 'medium', assignedTo: null } as any,
      actorId,
    );
    await taskService.update(
      t.id,
      { status: 'in_progress', assignedTo: assigneeId } as any,
      actorId,
    );
    const s = await prisma.activityLog.count({
      where: { action: 'task.status_changed', entityId: t.id },
    });
    const a = await prisma.activityLog.count({
      where: { action: 'task.assigned', entityId: t.id },
    });
    expect(s).toBe(1);
    expect(a).toBe(1);
  });
});
