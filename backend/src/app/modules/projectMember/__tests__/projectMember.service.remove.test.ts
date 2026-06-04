import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { projectMemberService } from '../projectMember.service';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 30) => new Date(Date.now() + days * 86_400_000);
const u = (label: string) => `pm-rm-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;

maybe('projectMemberService.removeMember', () => {
  let pmAId: string;
  let pmBId: string;
  let memberId: string;
  let projectId: string;
  let otherProjectId: string;
  const cleanupUserIds: string[] = [];
  const cleanupProjectIds: string[] = [];

  beforeAll(async () => {
    const a = await prisma.user.create({
      data: { email: u('pmA'), name: 'PM A', passwordHash: await bcrypt.hash('x', 4), role: 'project_manager' },
    });
    pmAId = a.id;
    cleanupUserIds.push(pmAId);
    const b = await prisma.user.create({
      data: { email: u('pmB'), name: 'PM B', passwordHash: await bcrypt.hash('x', 4), role: 'project_manager' },
    });
    pmBId = b.id;
    cleanupUserIds.push(pmBId);
    const m = await prisma.user.create({
      data: { email: u('mem'), name: 'Member', passwordHash: await bcrypt.hash('x', 4), role: 'team_member' },
    });
    memberId = m.id;
    cleanupUserIds.push(memberId);

    const p = await prisma.project.create({
      data: { name: `pm-rm-${Date.now()}`, deadline: future(), createdBy: pmAId },
    });
    projectId = p.id;
    cleanupProjectIds.push(projectId);

    const p2 = await prisma.project.create({
      data: { name: `pm-rm-other-${Date.now()}`, deadline: future(), createdBy: pmAId },
    });
    otherProjectId = p2.id;
    cleanupProjectIds.push(otherProjectId);
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
    await prisma.projectMember.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: cleanupProjectIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    await disconnectPrisma();
  });

  beforeEach(async () => {
    // Reset members + tasks before each test
    await prisma.task.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
    await prisma.projectMember.deleteMany({ where: { projectId: { in: cleanupProjectIds } } });
  });

  it('removes member row + auto-unassigns their tasks in same project', async () => {
    await prisma.projectMember.create({ data: { projectId, userId: pmAId, role: 'pm' } });
    const m = await prisma.projectMember.create({
      data: { projectId, userId: memberId, role: 'member' },
    });
    const t1 = await prisma.task.create({
      data: { projectId, title: 't1', dueDate: future(60), assignedTo: memberId, createdBy: pmAId },
    });
    const t2 = await prisma.task.create({
      data: { projectId, title: 't2', dueDate: future(60), assignedTo: memberId, createdBy: pmAId },
    });

    const out = await projectMemberService.removeMember(projectId, m.id);
    expect(out.tasksUnassigned).toBe(2);

    const post1 = await prisma.task.findUniqueOrThrow({ where: { id: t1.id } });
    const post2 = await prisma.task.findUniqueOrThrow({ where: { id: t2.id } });
    expect(post1.assignedTo).toBeNull();
    expect(post2.assignedTo).toBeNull();
    const exists = await prisma.projectMember.findUnique({ where: { id: m.id } });
    expect(exists).toBeNull();
  });

  it('does not touch tasks in OTHER projects for same user', async () => {
    await prisma.projectMember.create({ data: { projectId, userId: pmAId, role: 'pm' } });
    const m = await prisma.projectMember.create({
      data: { projectId, userId: memberId, role: 'member' },
    });
    await prisma.projectMember.create({
      data: { projectId: otherProjectId, userId: memberId, role: 'member' },
    });
    const otherTask = await prisma.task.create({
      data: {
        projectId: otherProjectId,
        title: 'other',
        dueDate: future(60),
        assignedTo: memberId,
        createdBy: pmAId,
      },
    });

    await projectMemberService.removeMember(projectId, m.id);

    const post = await prisma.task.findUniqueOrThrow({ where: { id: otherTask.id } });
    expect(post.assignedTo).toBe(memberId);
  });

  it('removes a pm when another pm exists', async () => {
    const pma = await prisma.projectMember.create({ data: { projectId, userId: pmAId, role: 'pm' } });
    await prisma.projectMember.create({ data: { projectId, userId: pmBId, role: 'pm' } });
    await prisma.task.create({
      data: { projectId, title: 'x', dueDate: future(60), createdBy: pmAId },
    });

    await projectMemberService.removeMember(projectId, pma.id);
    const remaining = await prisma.projectMember.count({ where: { projectId, role: 'pm' } });
    expect(remaining).toBe(1);
  });

  it('blocks removing the last pm when project has tasks', async () => {
    const pma = await prisma.projectMember.create({ data: { projectId, userId: pmAId, role: 'pm' } });
    await prisma.task.create({
      data: { projectId, title: 'x', dueDate: future(60), createdBy: pmAId },
    });

    await expect(projectMemberService.removeMember(projectId, pma.id)).rejects.toMatchObject({
      statusCode: 422,
      code: 'CANNOT_REMOVE_LAST_PM',
    });
  });

  it('allows removing the last pm when project has no tasks', async () => {
    const pma = await prisma.projectMember.create({ data: { projectId, userId: pmAId, role: 'pm' } });
    await projectMemberService.removeMember(projectId, pma.id);
    const exists = await prisma.projectMember.findUnique({ where: { id: pma.id } });
    expect(exists).toBeNull();
  });

  it('404 MEMBER_NOT_FOUND on missing id', async () => {
    await expect(
      projectMemberService.removeMember(projectId, '00000000-0000-4000-8000-000000000000'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'MEMBER_NOT_FOUND' });
  });
});
