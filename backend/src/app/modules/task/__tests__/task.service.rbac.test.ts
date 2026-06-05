import bcrypt from 'bcrypt';
import { ProjectStatus, Role, TaskPriority, TaskStatus } from '@prisma/client';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { projectService } from '../../project/project.service';
import { taskService } from '../task.service';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;
const dayFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

const ADMIN_EMAIL = 't-rbac-task-admin@test.local';
const PM1_EMAIL = 't-rbac-task-pm1@test.local';
const PM2_EMAIL = 't-rbac-task-pm2@test.local';
const MEMBER_EMAIL = 't-rbac-task-member@test.local';

maybe('taskService — RBAC scoping (member-visibility)', () => {
  let adminId: string;
  let pm1Id: string;
  let pm2Id: string;
  let memberId: string;
  let projA: string; // pm1 creator
  let projB: string; // pm2 creator
  let taskA1: string; // in projA
  let taskB1: string; // in projB

  beforeAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [ADMIN_EMAIL, PM1_EMAIL, PM2_EMAIL, MEMBER_EMAIL] } },
    });
    const [admin, pm1, pm2, member] = await Promise.all([
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
          email: PM1_EMAIL,
          name: 'P1',
          passwordHash: await bcrypt.hash('x', 4),
          role: Role.project_manager,
        },
      }),
      prisma.user.create({
        data: {
          email: PM2_EMAIL,
          name: 'P2',
          passwordHash: await bcrypt.hash('x', 4),
          role: Role.project_manager,
        },
      }),
      prisma.user.create({
        data: {
          email: MEMBER_EMAIL,
          name: 'M',
          passwordHash: await bcrypt.hash('x', 4),
          role: Role.team_member,
        },
      }),
    ]);
    adminId = admin.id;
    pm1Id = pm1.id;
    pm2Id = pm2.id;
    memberId = member.id;
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { createdBy: { in: [pm1Id, pm2Id, adminId] } } });
    await prisma.project.deleteMany({ where: { createdBy: { in: [pm1Id, pm2Id, adminId] } } });
    await prisma.user.deleteMany({
      where: { email: { in: [ADMIN_EMAIL, PM1_EMAIL, PM2_EMAIL, MEMBER_EMAIL] } },
    });
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await prisma.task.deleteMany({ where: { createdBy: { in: [pm1Id, pm2Id, adminId] } } });
    await prisma.project.deleteMany({ where: { createdBy: { in: [pm1Id, pm2Id, adminId] } } });
    const a = await projectService.create(
      { name: 'rbac-task-A', deadline: dayFromNow(5), status: ProjectStatus.active },
      pm1Id,
    );
    const b = await projectService.create(
      { name: 'rbac-task-B', deadline: dayFromNow(5), status: ProjectStatus.active },
      pm2Id,
    );
    projA = a.id;
    projB = b.id;
    const ta = await prisma.task.create({
      data: {
        projectId: projA,
        title: 'task-A1',
        status: TaskStatus.todo,
        priority: TaskPriority.medium,
        dueDate: dayFromNow(7),
        createdBy: pm1Id,
      },
    });
    const tb = await prisma.task.create({
      data: {
        projectId: projB,
        title: 'task-B1',
        status: TaskStatus.todo,
        priority: TaskPriority.medium,
        dueDate: dayFromNow(7),
        createdBy: pm2Id,
      },
    });
    taskA1 = ta.id;
    taskB1 = tb.id;
  });

  const listAs = (id: string, role: Role, projectId?: string) =>
    taskService.list({
      projectId,
      sort: 'created',
      page: 1,
      limit: 50,
      actor: { id, role },
    });

  describe('list (cross-project, no projectId)', () => {
    it('admin sees tasks from all projects', async () => {
      const r = await listAs(adminId, Role.admin);
      const titles = r.data.map((t) => t.title);
      expect(titles).toEqual(expect.arrayContaining(['task-A1', 'task-B1']));
    });

    it('pm1 sees only tasks in their own project', async () => {
      const r = await listAs(pm1Id, Role.project_manager);
      const titles = r.data.map((t) => t.title);
      expect(titles).toContain('task-A1');
      expect(titles).not.toContain('task-B1');
    });

    it('team_member with no memberships sees empty list', async () => {
      const r = await listAs(memberId, Role.team_member);
      expect(r.data.map((t) => t.title)).not.toContain('task-A1');
      expect(r.data.map((t) => t.title)).not.toContain('task-B1');
    });
  });

  describe('list (project-scoped)', () => {
    it('admin can list any project tasks', async () => {
      const r = await listAs(adminId, Role.admin, projB);
      expect(r.data.map((t) => t.title)).toEqual(['task-B1']);
    });

    it('non-member pm gets 403 on project-scoped list', async () => {
      await expect(listAs(pm1Id, Role.project_manager, projB)).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('non-member team_member gets 403 on project-scoped list', async () => {
      await expect(listAs(memberId, Role.team_member, projA)).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('explicitly-added team_member sees ALL tasks in the project', async () => {
      await prisma.projectMember.create({
        data: { projectId: projA, userId: memberId, role: 'member', addedById: pm1Id },
      });
      const r = await listAs(memberId, Role.team_member, projA);
      expect(r.data.map((t) => t.title)).toEqual(['task-A1']);
    });
  });

  describe('findById', () => {
    it('admin can read any task', async () => {
      const t = await taskService.findById(taskB1, { id: adminId, role: Role.admin });
      expect(t.id).toBe(taskB1);
    });

    it('non-member pm gets 403', async () => {
      await expect(
        taskService.findById(taskB1, { id: pm1Id, role: Role.project_manager }),
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    });

    it('non-member team_member gets 403', async () => {
      await expect(
        taskService.findById(taskA1, { id: memberId, role: Role.team_member }),
      ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    });

    it('explicitly-added team_member can read', async () => {
      await prisma.projectMember.create({
        data: { projectId: projB, userId: memberId, role: 'member', addedById: pm2Id },
      });
      const t = await taskService.findById(taskB1, { id: memberId, role: Role.team_member });
      expect(t.id).toBe(taskB1);
    });
  });
});
