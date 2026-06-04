import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { projectMemberService } from '../projectMember.service';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 30) => new Date(Date.now() + days * 86_400_000);
const u = (label: string) => `pm-list-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;

maybe('projectMemberService — listMembers + workload + updateRole', () => {
  let actorId: string;
  let memberAId: string;
  let memberBId: string;
  let projectId: string;
  let otherProjectId: string;
  const cleanupUserIds: string[] = [];
  const cleanupProjectIds: string[] = [];

  beforeAll(async () => {
    const actor = await prisma.user.create({
      data: { email: u('actor'), name: 'Actor', passwordHash: await bcrypt.hash('x', 4), role: 'project_manager' },
    });
    actorId = actor.id;
    cleanupUserIds.push(actorId);

    const mA = await prisma.user.create({
      data: { email: u('A'), name: 'Alice', passwordHash: await bcrypt.hash('x', 4), role: 'team_member' },
    });
    memberAId = mA.id;
    cleanupUserIds.push(memberAId);

    const mB = await prisma.user.create({
      data: { email: u('B'), name: 'Bob', passwordHash: await bcrypt.hash('x', 4), role: 'team_member' },
    });
    memberBId = mB.id;
    cleanupUserIds.push(memberBId);

    const p = await prisma.project.create({
      data: { name: `pm-list-${Date.now()}`, deadline: future(), createdBy: actorId },
    });
    projectId = p.id;
    cleanupProjectIds.push(projectId);

    const p2 = await prisma.project.create({
      data: { name: `pm-list-other-${Date.now()}`, deadline: future(), createdBy: actorId },
    });
    otherProjectId = p2.id;
    cleanupProjectIds.push(otherProjectId);

    // Seed members
    await prisma.projectMember.create({
      data: { projectId, userId: actorId, role: 'pm', addedById: actorId },
    });
    await prisma.projectMember.create({
      data: { projectId, userId: memberAId, role: 'member', addedById: actorId },
    });
    await prisma.projectMember.create({
      data: { projectId, userId: memberBId, role: 'member', addedById: actorId },
    });

    // Seed tasks for workload
    // memberA: 2 todo, 1 in_progress, 1 completed, 1 due_soon (within 5 days)
    await prisma.task.createMany({
      data: [
        { projectId, title: 'A-todo-1', dueDate: future(60), status: 'todo', priority: 'medium', assignedTo: memberAId, createdBy: actorId },
        { projectId, title: 'A-todo-2', dueDate: future(60), status: 'todo', priority: 'medium', assignedTo: memberAId, createdBy: actorId },
        { projectId, title: 'A-inp', dueDate: future(60), status: 'in_progress', priority: 'high', assignedTo: memberAId, createdBy: actorId },
        { projectId, title: 'A-done', dueDate: future(60), status: 'completed', priority: 'low', assignedTo: memberAId, createdBy: actorId },
        { projectId, title: 'A-due-soon', dueDate: future(5), status: 'todo', priority: 'high', assignedTo: memberAId, createdBy: actorId },
      ],
    });
    // memberB: 0 anything in this project
    // memberB has 1 task in OTHER project (must not appear in workload here)
    await prisma.task.create({
      data: {
        projectId: otherProjectId,
        title: 'B-other',
        dueDate: future(60),
        status: 'todo',
        priority: 'medium',
        assignedTo: memberBId,
        createdBy: actorId,
      },
    });
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
    await prisma.projectMember.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: cleanupProjectIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    await disconnectPrisma();
  });

  describe('listMembers', () => {
    it('returns each project member with workload counts', async () => {
      const rows = await projectMemberService.listMembers(projectId);
      expect(rows.length).toBe(3);
      const a = rows.find((r) => r.userId === memberAId);
      expect(a?.workload).toEqual({
        todo: 3, // 2 plain + 1 due-soon
        in_progress: 1,
        completed: 1,
        due_soon: 1,
      });
    });

    it('scopes workload to project — other projects ignored', async () => {
      const rows = await projectMemberService.listMembers(projectId);
      const b = rows.find((r) => r.userId === memberBId);
      expect(b?.workload).toEqual({ todo: 0, in_progress: 0, completed: 0, due_soon: 0 });
    });

    it('counts due_soon only for non-completed tasks due within 7 days', async () => {
      const rows = await projectMemberService.listMembers(projectId);
      const a = rows.find((r) => r.userId === memberAId);
      expect(a?.workload.due_soon).toBe(1);
    });

    it('orders members by user name ascending', async () => {
      const rows = await projectMemberService.listMembers(projectId);
      const names = rows.map((r) => r.user.name);
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });

    it('404 PROJECT_NOT_FOUND on unknown project', async () => {
      await expect(
        projectMemberService.listMembers('00000000-0000-4000-8000-000000000000'),
      ).rejects.toMatchObject({ statusCode: 404, code: 'PROJECT_NOT_FOUND' });
    });
  });

  describe('updateRole', () => {
    it('flips member -> pm', async () => {
      const before = await prisma.projectMember.findFirstOrThrow({ where: { projectId, userId: memberAId } });
      const out = await projectMemberService.updateRole(projectId, before.id, 'pm');
      expect(out.role).toBe('pm');
      // revert for further tests
      await projectMemberService.updateRole(projectId, before.id, 'member');
    });

    it('404 MEMBER_NOT_FOUND on unknown id', async () => {
      await expect(
        projectMemberService.updateRole(projectId, '00000000-0000-4000-8000-000000000000', 'pm'),
      ).rejects.toMatchObject({ statusCode: 404, code: 'MEMBER_NOT_FOUND' });
    });
  });
});
