import bcrypt from 'bcrypt';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { taskService } from '../task.service';
import { UNASSIGNED } from '../task.constant';

const TEST_EMAIL = 't6-task-list@test.local';
const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 7) => new Date(Date.now() + days * 86_400_000);

maybe('taskService list', () => {
  let actorId: string;
  let assigneeId: string;
  let projectA: string;
  let projectB: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [TEST_EMAIL, `a-${TEST_EMAIL}`] } } });
    const u = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'List Creator',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'admin',
      },
    });
    actorId = u.id;
    const a = await prisma.user.create({
      data: {
        email: `a-${TEST_EMAIL}`,
        name: 'List Assignee',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'team_member',
      },
    });
    assigneeId = a.id;

    const pA = await prisma.project.create({
      data: { name: 'List Project A', deadline: future(30), status: 'active', createdBy: actorId },
    });
    projectA = pA.id;
    const pB = await prisma.project.create({
      data: { name: 'List Project B', deadline: future(30), status: 'active', createdBy: actorId },
    });
    projectB = pB.id;

    await prisma.task.deleteMany({ where: { projectId: { in: [projectA, projectB] } } });

    // Seed 6 tasks in A (varied), 2 in B
    await taskService.create(
      { projectId: projectA, title: 'Alpha High Todo', dueDate: future(2), status: TaskStatus.todo, priority: TaskPriority.high, assignedTo: assigneeId },
      actorId,
    );
    await taskService.create(
      { projectId: projectA, title: 'Alpha Med InProg', dueDate: future(10), status: TaskStatus.in_progress, priority: TaskPriority.medium, assignedTo: assigneeId },
      actorId,
    );
    await taskService.create(
      { projectId: projectA, title: 'Beta Low Done', dueDate: future(5), status: TaskStatus.completed, priority: TaskPriority.low, assignedTo: actorId },
      actorId,
    );
    await taskService.create(
      { projectId: projectA, title: 'Beta High Todo', dueDate: future(1), status: TaskStatus.todo, priority: TaskPriority.high, assignedTo: null },
      actorId,
    );
    await taskService.create(
      { projectId: projectA, title: 'Gamma Med Todo', dueDate: future(3), status: TaskStatus.todo, priority: TaskPriority.medium, assignedTo: null },
      actorId,
    );
    await taskService.create(
      { projectId: projectB, title: 'B-Task One', dueDate: future(7), status: TaskStatus.todo, priority: TaskPriority.medium },
      actorId,
    );
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { projectId: { in: [projectA, projectB] } } });
    await prisma.project.deleteMany({ where: { id: { in: [projectA, projectB] } } });
    await prisma.user.deleteMany({ where: { id: { in: [actorId, assigneeId] } } });
    await disconnectPrisma();
  });

  it('filters by projectId', async () => {
    const r = await taskService.list({ projectId: projectA, sort: 'created', page: 1, limit: 20 });
    expect(r.total).toBe(5);
    expect(r.data.every((t) => t.projectId === projectA)).toBe(true);
  });

  it('filters by status', async () => {
    const r = await taskService.list({
      projectId: projectA,
      status: TaskStatus.todo,
      sort: 'created',
      page: 1,
      limit: 20,
    });
    expect(r.total).toBe(3);
    expect(r.data.every((t) => t.status === 'todo')).toBe(true);
  });

  it('filters by priority=high', async () => {
    const r = await taskService.list({
      projectId: projectA,
      priority: TaskPriority.high,
      sort: 'created',
      page: 1,
      limit: 20,
    });
    expect(r.total).toBe(2);
    expect(r.data.every((t) => t.priority === 'high')).toBe(true);
  });

  it('filters by assignee uuid', async () => {
    const r = await taskService.list({
      projectId: projectA,
      assignedTo: assigneeId,
      sort: 'created',
      page: 1,
      limit: 20,
    });
    expect(r.total).toBe(2);
    expect(r.data.every((t) => t.assignedTo === assigneeId)).toBe(true);
  });

  it("filters by assignedTo='unassigned'", async () => {
    const r = await taskService.list({
      projectId: projectA,
      assignedTo: UNASSIGNED,
      sort: 'created',
      page: 1,
      limit: 20,
    });
    expect(r.total).toBe(2);
    expect(r.data.every((t) => t.assignedTo === null)).toBe(true);
  });

  it('search q (case-insensitive contains)', async () => {
    const r = await taskService.list({
      projectId: projectA,
      q: 'alpha',
      sort: 'created',
      page: 1,
      limit: 20,
    });
    expect(r.total).toBe(2);
  });

  it('sort=dueDate orders nearest-first', async () => {
    const r = await taskService.list({ projectId: projectA, sort: 'dueDate', page: 1, limit: 20 });
    const dates = r.data.map((t) => new Date(t.dueDate).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
    }
  });

  it('sort=priority orders high first', async () => {
    const r = await taskService.list({ projectId: projectA, sort: 'priority', page: 1, limit: 20 });
    expect(r.data[0].priority).toBe('high');
  });

  it('pagination: limit=2 page=2 returns disjoint slice', async () => {
    const p1 = await taskService.list({ projectId: projectA, sort: 'created', page: 1, limit: 2 });
    const p2 = await taskService.list({ projectId: projectA, sort: 'created', page: 2, limit: 2 });
    expect(p1.data.length).toBe(2);
    expect(p2.data.length).toBe(2);
    const ids1 = p1.data.map((t) => t.id);
    const ids2 = p2.data.map((t) => t.id);
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    expect(p1.total).toBe(5);
  });

  it('cross-project list omits projectId filter', async () => {
    const r = await taskService.list({ sort: 'created', page: 1, limit: 20 });
    expect(r.total).toBeGreaterThanOrEqual(6);
  });

  it('returns embedded creator and assignee', async () => {
    const r = await taskService.list({ projectId: projectA, sort: 'created', page: 1, limit: 5 });
    expect(r.data[0].creator.email).toBe(TEST_EMAIL);
    const assigned = r.data.find((t) => t.assignedTo === assigneeId);
    expect(assigned?.assignee?.email).toBe(`a-${TEST_EMAIL}`);
  });
});
