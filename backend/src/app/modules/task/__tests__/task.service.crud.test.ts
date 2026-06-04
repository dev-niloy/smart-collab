import bcrypt from 'bcrypt';
import { TaskStatus, TaskPriority } from '@prisma/client';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { taskService } from '../task.service';
import {
  PAST_DEADLINE_MESSAGE,
  DUPLICATE_TASK_TITLE_MESSAGE,
  REASSIGN_COMPLETED_MESSAGE,
} from '../task.constant';

const TEST_EMAIL = 't5-task-svc@test.local';
const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 7) => new Date(Date.now() + days * 86_400_000);
const past = () => new Date(Date.now() - 86_400_000);

maybe('taskService CRUD', () => {
  let actorId: string;
  let assigneeId: string;
  let projectId: string;
  let otherProjectId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [TEST_EMAIL, `assignee-${TEST_EMAIL}`] } } });
    const u = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Svc Creator',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'admin',
      },
    });
    actorId = u.id;
    const a = await prisma.user.create({
      data: {
        email: `assignee-${TEST_EMAIL}`,
        name: 'Svc Assignee',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'team_member',
      },
    });
    assigneeId = a.id;
    const p = await prisma.project.create({
      data: { name: 'T5 Project', deadline: future(30), status: 'active', createdBy: actorId },
    });
    projectId = p.id;
    const p2 = await prisma.project.create({
      data: { name: 'T5 Other Project', deadline: future(30), status: 'active', createdBy: actorId },
    });
    otherProjectId = p2.id;
    // C13: tasks now require assignee to be a project member (admin bypass).
    // actor is admin → bypass works for actor. assignee is team_member → add to both projects.
    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: assigneeId, role: 'member' },
        { projectId: otherProjectId, userId: assigneeId, role: 'member' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
    await prisma.projectMember.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
    await prisma.project.deleteMany({ where: { id: { in: [projectId, otherProjectId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [actorId, assigneeId] } } });
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await prisma.task.deleteMany({ where: { projectId: { in: [projectId, otherProjectId] } } });
  });

  describe('create', () => {
    it('inserts row with createdBy + creator + assignee embed + defaults', async () => {
      const t = await taskService.create(
        {
          projectId,
          title: 'Write docs',
          dueDate: future(),
          status: TaskStatus.todo,
          priority: TaskPriority.medium,
          assignedTo: assigneeId,
        },
        actorId,
      );
      expect(t.id).toBeTruthy();
      expect(t.createdBy).toBe(actorId);
      expect(t.assignedTo).toBe(assigneeId);
      expect(t.status).toBe('todo');
      expect(t.priority).toBe('medium');
      expect(t.creator.email).toBe(TEST_EMAIL);
      expect(t.assignee?.email).toBe(`assignee-${TEST_EMAIL}`);
    });

    it('allows null assignee', async () => {
      const t = await taskService.create(
        {
          projectId,
          title: 'Unassigned task',
          dueDate: future(),
          status: TaskStatus.todo,
          priority: TaskPriority.medium,
          assignedTo: null,
        },
        actorId,
      );
      expect(t.assignedTo).toBeNull();
      expect(t.assignee).toBeNull();
    });

    it('rejects past due date with 422 assessment-verbatim', async () => {
      await expect(
        taskService.create(
          {
            projectId,
            title: 'Late',
            dueDate: past(),
            status: TaskStatus.todo,
            priority: TaskPriority.medium,
          },
          actorId,
        ),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'PAST_DEADLINE',
        message: PAST_DEADLINE_MESSAGE,
      });
    });

    it('rejects when project does not exist', async () => {
      await expect(
        taskService.create(
          {
            projectId: '00000000-0000-0000-0000-000000000000',
            title: 'Orphan',
            dueDate: future(),
            status: TaskStatus.todo,
            priority: TaskPriority.medium,
          },
          actorId,
        ),
      ).rejects.toMatchObject({ statusCode: 404, code: 'PROJECT_NOT_FOUND' });
    });

    it('rejects duplicate title within same project (case-insensitive) — assessment-verbatim', async () => {
      await taskService.create(
        { projectId, title: 'Ship it', dueDate: future(), status: TaskStatus.todo, priority: TaskPriority.medium },
        actorId,
      );
      await expect(
        taskService.create(
          { projectId, title: 'SHIP IT', dueDate: future(), status: TaskStatus.todo, priority: TaskPriority.medium },
          actorId,
        ),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'DUPLICATE_TASK_TITLE',
        message: DUPLICATE_TASK_TITLE_MESSAGE,
      });
    });

    it('allows same title in DIFFERENT project', async () => {
      await taskService.create(
        { projectId, title: 'Common name', dueDate: future(), status: TaskStatus.todo, priority: TaskPriority.medium },
        actorId,
      );
      const t2 = await taskService.create(
        {
          projectId: otherProjectId,
          title: 'Common name',
          dueDate: future(),
          status: TaskStatus.todo,
          priority: TaskPriority.medium,
        },
        actorId,
      );
      expect(t2.projectId).toBe(otherProjectId);
    });
  });

  describe('findById', () => {
    it('returns task with relations', async () => {
      const created = await taskService.create(
        { projectId, title: 'F1', dueDate: future(), status: TaskStatus.todo, priority: TaskPriority.medium },
        actorId,
      );
      const fetched = await taskService.findById(created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.creator.email).toBe(TEST_EMAIL);
    });

    it('throws 404 when missing', async () => {
      await expect(
        taskService.findById('00000000-0000-0000-0000-000000000000'),
      ).rejects.toMatchObject({ statusCode: 404, code: 'TASK_NOT_FOUND' });
    });
  });

  describe('update', () => {
    it('patches title, status, priority', async () => {
      const created = await taskService.create(
        { projectId, title: 'Original', dueDate: future(), status: TaskStatus.todo, priority: TaskPriority.low },
        actorId,
      );
      const updated = await taskService.update(created.id, {
        title: 'Renamed',
        status: TaskStatus.in_progress,
        priority: TaskPriority.high,
      });
      expect(updated.title).toBe('Renamed');
      expect(updated.status).toBe('in_progress');
      expect(updated.priority).toBe('high');
    });

    it('rejects past dueDate on update', async () => {
      const created = await taskService.create(
        { projectId, title: 'U1', dueDate: future(), status: TaskStatus.todo, priority: TaskPriority.medium },
        actorId,
      );
      await expect(
        taskService.update(created.id, { dueDate: past() }),
      ).rejects.toMatchObject({ statusCode: 422, code: 'PAST_DEADLINE' });
    });

    it('rejects duplicate title within same project on update', async () => {
      await taskService.create(
        { projectId, title: 'Existing', dueDate: future(), status: TaskStatus.todo, priority: TaskPriority.medium },
        actorId,
      );
      const other = await taskService.create(
        { projectId, title: 'Other', dueDate: future(), status: TaskStatus.todo, priority: TaskPriority.medium },
        actorId,
      );
      await expect(
        taskService.update(other.id, { title: 'EXISTING' }),
      ).rejects.toMatchObject({ statusCode: 422, code: 'DUPLICATE_TASK_TITLE' });
    });

    it('allows updating title to same case-insensitive value', async () => {
      const created = await taskService.create(
        { projectId, title: 'Stable', dueDate: future(), status: TaskStatus.todo, priority: TaskPriority.medium },
        actorId,
      );
      const updated = await taskService.update(created.id, { title: 'STABLE' });
      expect(updated.title).toBe('STABLE');
    });

    it('blocks reassign when task already completed (assignedTo change)', async () => {
      const created = await taskService.create(
        {
          projectId,
          title: 'Done task',
          dueDate: future(),
          status: TaskStatus.completed,
          priority: TaskPriority.medium,
          assignedTo: actorId,
        },
        actorId,
      );
      await expect(
        taskService.update(created.id, { assignedTo: assigneeId }),
      ).rejects.toMatchObject({
        statusCode: 422,
        code: 'REASSIGN_COMPLETED',
        message: REASSIGN_COMPLETED_MESSAGE,
      });
    });

    it('blocks reassign when transitioning to completed AND changing assignee in same PATCH', async () => {
      const created = await taskService.create(
        {
          projectId,
          title: 'In progress',
          dueDate: future(),
          status: TaskStatus.in_progress,
          priority: TaskPriority.medium,
          assignedTo: actorId,
        },
        actorId,
      );
      await expect(
        taskService.update(created.id, { status: TaskStatus.completed, assignedTo: assigneeId }),
      ).rejects.toMatchObject({ statusCode: 422, code: 'REASSIGN_COMPLETED' });
    });

    it('allows status -> completed without reassign', async () => {
      const created = await taskService.create(
        {
          projectId,
          title: 'Finishing',
          dueDate: future(),
          status: TaskStatus.in_progress,
          priority: TaskPriority.medium,
          assignedTo: actorId,
        },
        actorId,
      );
      const updated = await taskService.update(created.id, { status: TaskStatus.completed });
      expect(updated.status).toBe('completed');
    });

    it('404 when missing id', async () => {
      await expect(
        taskService.update('00000000-0000-0000-0000-000000000000', { title: 'x' }),
      ).rejects.toMatchObject({ statusCode: 404, code: 'TASK_NOT_FOUND' });
    });
  });

  describe('remove', () => {
    it('deletes the row', async () => {
      const created = await taskService.create(
        { projectId, title: 'Bye', dueDate: future(), status: TaskStatus.todo, priority: TaskPriority.medium },
        actorId,
      );
      await taskService.remove(created.id);
      const after = await prisma.task.findUnique({ where: { id: created.id } });
      expect(after).toBeNull();
    });

    it('404 when removing missing id', async () => {
      await expect(
        taskService.remove('00000000-0000-0000-0000-000000000000'),
      ).rejects.toMatchObject({ statusCode: 404, code: 'TASK_NOT_FOUND' });
    });
  });

  describe('cascade', () => {
    it('deleting parent project cascades tasks', async () => {
      const tempProj = await prisma.project.create({
        data: { name: 'TempProj', deadline: future(30), status: 'active', createdBy: actorId },
      });
      await taskService.create(
        { projectId: tempProj.id, title: 'Cascaded', dueDate: future(), status: TaskStatus.todo, priority: TaskPriority.medium },
        actorId,
      );
      const before = await prisma.task.count({ where: { projectId: tempProj.id } });
      expect(before).toBe(1);
      await prisma.project.delete({ where: { id: tempProj.id } });
      const after = await prisma.task.count({ where: { projectId: tempProj.id } });
      expect(after).toBe(0);
    });
  });

  describe('C13 assignee-must-be-project-member guard', () => {
    let nonMemberId: string;
    beforeAll(async () => {
      const u = await prisma.user.create({
        data: {
          email: `nonmember-${TEST_EMAIL}`,
          name: 'Non Member',
          passwordHash: await bcrypt.hash('x', 4),
          role: 'team_member',
        },
      });
      nonMemberId = u.id;
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { id: nonMemberId } });
    });

    it('blocks create when assignedTo is not a project member', async () => {
      await expect(
        taskService.create(
          { projectId, title: 'C13-create', dueDate: future(), status: TaskStatus.todo, priority: TaskPriority.medium, assignedTo: nonMemberId },
          actorId,
        ),
      ).rejects.toMatchObject({ statusCode: 422, code: 'ASSIGNEE_NOT_PROJECT_MEMBER' });
    });

    it('blocks update when reassigning to non-member', async () => {
      const t = await taskService.create(
        { projectId, title: 'C13-update', dueDate: future(), status: TaskStatus.todo, priority: TaskPriority.medium, assignedTo: assigneeId },
        actorId,
      );
      await expect(
        taskService.update(t.id, { assignedTo: nonMemberId }),
      ).rejects.toMatchObject({ statusCode: 422, code: 'ASSIGNEE_NOT_PROJECT_MEMBER' });
    });

    it('allows assigning system admin even when not a ProjectMember (admin bypass)', async () => {
      const t = await taskService.create(
        { projectId, title: 'C13-admin-bypass', dueDate: future(), status: TaskStatus.todo, priority: TaskPriority.medium, assignedTo: actorId },
        actorId,
      );
      expect(t.assignedTo).toBe(actorId);
    });

    it('allows null assignedTo (unassigned) regardless of membership', async () => {
      const t = await taskService.create(
        { projectId, title: 'C13-null', dueDate: future(), status: TaskStatus.todo, priority: TaskPriority.medium, assignedTo: null },
        actorId,
      );
      expect(t.assignedTo).toBeNull();
    });
  });
});
