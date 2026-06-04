import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { projectMemberService } from '../projectMember.service';

const TEST_EMAIL = 'mem-act@test.local';
const NEW_MEMBER_EMAIL = 'mem-act-new@test.local';
const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 7) => new Date(Date.now() + days * 86_400_000);

maybe('projectMember.service activity emissions', () => {
  let actorId: string;
  let newUserId: string;
  let projectId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [TEST_EMAIL, NEW_MEMBER_EMAIL] } } });
    const u = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Mem Act',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'admin',
      },
    });
    actorId = u.id;
    const n = await prisma.user.create({
      data: {
        email: NEW_MEMBER_EMAIL,
        name: 'New Member',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'team_member',
      },
    });
    newUserId = n.id;
  });

  beforeEach(async () => {
    await prisma.activityLog.deleteMany({ where: { actorId } });
    await prisma.project.deleteMany({ where: { name: { startsWith: 'MemAct' } } });
    const p = await prisma.project.create({
      data: { name: 'MemAct Proj', deadline: future(30), status: 'active', createdBy: actorId },
    });
    projectId = p.id;
    // Mimic projectService auto-PM so removeMember has a PM row to reason about.
    await prisma.projectMember.create({
      data: { projectId, userId: actorId, role: 'pm', addedById: actorId },
    });
    await prisma.activityLog.deleteMany({ where: { projectId } });
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { actorId } });
    await prisma.project.deleteMany({ where: { name: { startsWith: 'MemAct' } } });
    await prisma.user.deleteMany({ where: { id: { in: [actorId, newUserId] } } });
    await disconnectPrisma();
  });

  it('emits member.added on addMember', async () => {
    const m = await projectMemberService.addMember(projectId, NEW_MEMBER_EMAIL, 'member', actorId);
    const log = await prisma.activityLog.findFirst({
      where: { action: 'member.added', entityId: m.id },
    });
    expect(log).not.toBeNull();
    expect(log!.projectId).toBe(projectId);
    expect(log!.entityType).toBe('member');
    const meta = log!.meta as Record<string, unknown>;
    expect(meta.userId).toBe(newUserId);
  });

  it('emits member.removed on removeMember', async () => {
    const m = await projectMemberService.addMember(projectId, NEW_MEMBER_EMAIL, 'member', actorId);
    await projectMemberService.removeMember(projectId, m.id, actorId);
    const log = await prisma.activityLog.findFirst({
      where: { action: 'member.removed', entityId: m.id },
    });
    expect(log).not.toBeNull();
    expect(log!.projectId).toBe(projectId);
  });

  it('preserves addMember return shape', async () => {
    const m = await projectMemberService.addMember(projectId, NEW_MEMBER_EMAIL, 'member', actorId);
    expect(m.user).toBeDefined();
    expect(m.user.email).toBe(NEW_MEMBER_EMAIL);
  });

  it('rolls back activity log when removeMember violates last-pm rule', async () => {
    // Create a task so the last-PM removal is blocked
    await prisma.task.create({
      data: {
        projectId,
        title: 'Blocker',
        dueDate: future(5),
        status: 'todo',
        priority: 'medium',
        createdBy: actorId,
      },
    });
    const pmMember = await prisma.projectMember.findFirst({
      where: { projectId, role: 'pm' },
    });
    await expect(
      projectMemberService.removeMember(projectId, pmMember!.id, actorId),
    ).rejects.toThrow();
    const count = await prisma.activityLog.count({
      where: { action: 'member.removed', entityId: pmMember!.id },
    });
    expect(count).toBe(0);
  });
});
