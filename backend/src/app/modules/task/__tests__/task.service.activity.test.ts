import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { taskService } from '../task.service';

const TEST_EMAIL = 'task-act@test.local';
const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 7) => new Date(Date.now() + days * 86_400_000);

maybe('task.service activity emissions', () => {
  let actorId: string;
  let projectId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    const u = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Task Act',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'admin',
      },
    });
    actorId = u.id;
  });

  beforeEach(async () => {
    await prisma.activityLog.deleteMany({ where: { actorId } });
    await prisma.task.deleteMany({ where: { project: { name: { startsWith: 'TaskAct' } } } });
    await prisma.project.deleteMany({ where: { name: { startsWith: 'TaskAct' } } });
    const p = await prisma.project.create({
      data: { name: 'TaskAct Proj', deadline: future(30), status: 'active', createdBy: actorId },
    });
    projectId = p.id;
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { actorId } });
    await prisma.task.deleteMany({ where: { project: { name: { startsWith: 'TaskAct' } } } });
    await prisma.project.deleteMany({ where: { name: { startsWith: 'TaskAct' } } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await disconnectPrisma();
  });

  it('emits task.created on create', async () => {
    const t = await taskService.create(
      {
        projectId,
        title: 'New Task',
        description: 'd',
        dueDate: future(5),
        status: 'todo',
        priority: 'medium',
        assignedTo: null,
      } as any,
      actorId,
    );
    const log = await prisma.activityLog.findFirst({
      where: { action: 'task.created', entityId: t.id },
    });
    expect(log).not.toBeNull();
    expect(log!.projectId).toBe(projectId);
    expect(log!.entityType).toBe('task');
    expect(log!.actorId).toBe(actorId);
  });

  it('emits task.updated on field change', async () => {
    const t = await taskService.create(
      {
        projectId,
        title: 'Original',
        dueDate: future(5),
        status: 'todo',
        priority: 'medium',
        assignedTo: null,
      } as any,
      actorId,
    );
    await taskService.update(t.id, { title: 'Renamed' } as any);
    const log = await prisma.activityLog.findFirst({
      where: { action: 'task.updated', entityId: t.id },
    });
    expect(log).not.toBeNull();
    const meta = log!.meta as Record<string, unknown>;
    expect(meta.title).toBe('Renamed');
  });

  it('does not emit task.updated on no-op update', async () => {
    const t = await taskService.create(
      {
        projectId,
        title: 'Stable',
        dueDate: future(5),
        status: 'todo',
        priority: 'medium',
        assignedTo: null,
      } as any,
      actorId,
    );
    await taskService.update(t.id, {} as any);
    const count = await prisma.activityLog.count({
      where: { action: 'task.updated', entityId: t.id },
    });
    expect(count).toBe(0);
  });

  it('emits task.deleted on delete', async () => {
    const t = await taskService.create(
      {
        projectId,
        title: 'Doomed',
        dueDate: future(5),
        status: 'todo',
        priority: 'medium',
        assignedTo: null,
      } as any,
      actorId,
    );
    await taskService.remove(t.id, actorId);
    const log = await prisma.activityLog.findFirst({
      where: { action: 'task.deleted', entityId: t.id },
    });
    expect(log).not.toBeNull();
    expect(log!.projectId).toBe(projectId);
  });

  it('does not break existing create return shape', async () => {
    const t = await taskService.create(
      {
        projectId,
        title: 'Shape Check',
        dueDate: future(5),
        status: 'todo',
        priority: 'medium',
        assignedTo: null,
      } as any,
      actorId,
    );
    expect(t.id).toBeDefined();
    expect(t.creator).toBeDefined();
    expect(t.assignee).toBeNull();
  });

  it('rolls back activity log when create fails after the row', async () => {
    // Force unique violation by creating duplicate title in same project
    await taskService.create(
      {
        projectId,
        title: 'Twin',
        dueDate: future(5),
        status: 'todo',
        priority: 'medium',
        assignedTo: null,
      } as any,
      actorId,
    );
    const before = await prisma.activityLog.count({ where: { action: 'task.created', projectId } });
    await expect(
      taskService.create(
        {
          projectId,
          title: 'Twin',
          dueDate: future(5),
          status: 'todo',
          priority: 'medium',
          assignedTo: null,
        } as any,
        actorId,
      ),
    ).rejects.toThrow();
    const after = await prisma.activityLog.count({ where: { action: 'task.created', projectId } });
    expect(after).toBe(before);
  });
});
