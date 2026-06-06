import bcrypt from 'bcrypt';
import { ProjectStatus, Role, TaskPriority, TaskStatus } from '@prisma/client';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { projectService } from '../../project/project.service';
import { taskService } from '../task.service';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;
const dayFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

const ADMIN_EMAIL = 'taw-admin@test.local';
const PM_EMAIL = 'taw-pm@test.local';
const ASSIGNEE_EMAIL = 'taw-assignee@test.local';
const OTHER_EMAIL = 'taw-other@test.local';

maybe('taskService.update — assignee/PM/admin write gate', () => {
  let adminId: string;
  let pmId: string;
  let assigneeId: string;
  let otherId: string;
  let projId: string;
  let taskAssigned: string; // assigned to `assigneeId`
  let taskUnassigned: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [ADMIN_EMAIL, PM_EMAIL, ASSIGNEE_EMAIL, OTHER_EMAIL] } },
    });
    const [a, p, asg, oth] = await Promise.all([
      prisma.user.create({
        data: {
          email: ADMIN_EMAIL,
          name: 'A',
          passwordHash: await bcrypt.hash('x', 4),
          role: Role.admin,
        },
      }),
      prisma.user.create({
        data: {
          email: PM_EMAIL,
          name: 'P',
          passwordHash: await bcrypt.hash('x', 4),
          role: Role.project_manager,
        },
      }),
      prisma.user.create({
        data: {
          email: ASSIGNEE_EMAIL,
          name: 'AS',
          passwordHash: await bcrypt.hash('x', 4),
          role: Role.team_member,
        },
      }),
      prisma.user.create({
        data: {
          email: OTHER_EMAIL,
          name: 'OT',
          passwordHash: await bcrypt.hash('x', 4),
          role: Role.team_member,
        },
      }),
    ]);
    adminId = a.id;
    pmId = p.id;
    assigneeId = asg.id;
    otherId = oth.id;
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { createdBy: { in: [pmId, adminId] } } });
    await prisma.project.deleteMany({ where: { createdBy: { in: [pmId, adminId] } } });
    await prisma.user.deleteMany({
      where: { email: { in: [ADMIN_EMAIL, PM_EMAIL, ASSIGNEE_EMAIL, OTHER_EMAIL] } },
    });
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await prisma.task.deleteMany({ where: { createdBy: { in: [pmId, adminId] } } });
    await prisma.project.deleteMany({ where: { createdBy: { in: [pmId, adminId] } } });
    const proj = await projectService.create(
      { name: 'taw-proj', deadline: dayFromNow(5), status: ProjectStatus.active },
      pmId,
    );
    projId = proj.id;
    // add both members
    await prisma.projectMember.createMany({
      data: [
        { projectId: projId, userId: assigneeId, role: 'member', addedById: pmId },
        { projectId: projId, userId: otherId, role: 'member', addedById: pmId },
      ],
    });
    const t1 = await prisma.task.create({
      data: {
        projectId: projId,
        title: 'assigned-task',
        status: TaskStatus.todo,
        priority: TaskPriority.medium,
        dueDate: dayFromNow(7),
        createdBy: pmId,
        assignedTo: assigneeId,
      },
    });
    const t2 = await prisma.task.create({
      data: {
        projectId: projId,
        title: 'unassigned-task',
        status: TaskStatus.todo,
        priority: TaskPriority.medium,
        dueDate: dayFromNow(7),
        createdBy: pmId,
      },
    });
    taskAssigned = t1.id;
    taskUnassigned = t2.id;
  });

  it('assignee can update own task status', async () => {
    const t = await taskService.update(
      taskAssigned,
      { status: TaskStatus.in_progress },
      assigneeId,
      { id: assigneeId, role: Role.team_member },
    );
    expect(t.status).toBe(TaskStatus.in_progress);
  });

  it('non-assignee member → 403 TASK_WRITE_FORBIDDEN on status change', async () => {
    await expect(
      taskService.update(
        taskAssigned,
        { status: TaskStatus.in_progress },
        otherId,
        { id: otherId, role: Role.team_member },
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: 'TASK_WRITE_FORBIDDEN' });
  });

  it('PM can update any task in project', async () => {
    const t = await taskService.update(
      taskAssigned,
      { priority: TaskPriority.high },
      pmId,
      { id: pmId, role: Role.project_manager },
    );
    expect(t.priority).toBe(TaskPriority.high);
  });

  it('admin can update any task', async () => {
    const t = await taskService.update(
      taskAssigned,
      { title: 'admin-renamed' },
      adminId,
      { id: adminId, role: Role.admin },
    );
    expect(t.title).toBe('admin-renamed');
  });

  it('assignee cannot reassign (CANNOT_REASSIGN)', async () => {
    await expect(
      taskService.update(
        taskAssigned,
        { assignedTo: otherId },
        assigneeId,
        { id: assigneeId, role: Role.team_member },
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: 'CANNOT_REASSIGN' });
  });

  it('PM can reassign', async () => {
    const t = await taskService.update(
      taskAssigned,
      { assignedTo: otherId },
      pmId,
      { id: pmId, role: Role.project_manager },
    );
    expect(t.assignedTo).toBe(otherId);
  });

  it('unassigned task: member cannot change status', async () => {
    await expect(
      taskService.update(
        taskUnassigned,
        { status: TaskStatus.in_progress },
        otherId,
        { id: otherId, role: Role.team_member },
      ),
    ).rejects.toMatchObject({ statusCode: 403, code: 'TASK_WRITE_FORBIDDEN' });
  });

  it('unassigned task: PM can change status', async () => {
    const t = await taskService.update(
      taskUnassigned,
      { status: TaskStatus.in_progress },
      pmId,
      { id: pmId, role: Role.project_manager },
    );
    expect(t.status).toBe(TaskStatus.in_progress);
  });

  it('legacy callsite without actor still works (backward-compat = admin)', async () => {
    const t = await taskService.update(taskAssigned, { status: TaskStatus.completed }, pmId);
    expect(t.status).toBe(TaskStatus.completed);
  });
});
