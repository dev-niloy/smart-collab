import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { projectMemberService } from '../projectMember.service';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 30) => new Date(Date.now() + days * 86_400_000);
const u = (label: string) => `pm-notif-${label}-${Date.now()}@test.local`;

// Integration test: addMember + updateRole should produce in-app notification
// rows for the affected user. Email fan-out is verified at the helper level
// in email.enqueue tests; here we lock the service-layer contract.
maybe('projectMemberService — notifications on member events', () => {
  let actorId: string;
  let recipientId: string;
  let secondRecipientId: string;
  let projectId: string;
  const cleanupUserIds: string[] = [];
  const cleanupProjectIds: string[] = [];

  beforeAll(async () => {
    const actor = await prisma.user.create({
      data: {
        email: u('actor'),
        name: 'PM Actor',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'project_manager',
      },
    });
    actorId = actor.id;
    cleanupUserIds.push(actorId);

    const recipient = await prisma.user.create({
      data: {
        email: u('recipient'),
        name: 'Recipient User',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'team_member',
      },
    });
    recipientId = recipient.id;
    cleanupUserIds.push(recipientId);

    const second = await prisma.user.create({
      data: {
        email: u('second'),
        name: 'Second User',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'team_member',
      },
    });
    secondRecipientId = second.id;
    cleanupUserIds.push(secondRecipientId);

    const project = await prisma.project.create({
      data: {
        name: `PM-Notif ${Date.now()}`,
        description: 'Test project for member notifications',
        deadline: future(60),
        status: 'active',
        createdBy: actorId,
      },
    });
    projectId = project.id;
    cleanupProjectIds.push(projectId);
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({
      where: { projectId: { in: cleanupProjectIds } },
    });
    await prisma.projectMember.deleteMany({
      where: { projectId: { in: cleanupProjectIds } },
    });
    await prisma.activityLog.deleteMany({
      where: { projectId: { in: cleanupProjectIds } },
    });
    await prisma.project.deleteMany({ where: { id: { in: cleanupProjectIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await prisma.notification.deleteMany({
      where: { projectId, recipientId: { in: [recipientId, secondRecipientId, actorId] } },
    });
    await prisma.projectMember.deleteMany({
      where: { projectId, userId: { in: [recipientId, secondRecipientId] } },
    });
  });

  it('addMember writes a notification with type, actor, recipient, projectId', async () => {
    const memberEmail = (await prisma.user.findUnique({ where: { id: recipientId } }))!
      .email;
    const member = await projectMemberService.addMember(
      projectId,
      memberEmail,
      'member',
      actorId,
    );
    expect(member.userId).toBe(recipientId);

    const rows = await prisma.notification.findMany({
      where: { projectId, recipientId, type: 'project.member_added' },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
    expect(rows).toHaveLength(1);
    const n = rows[0];
    expect(n.recipientId).toBe(recipientId);
    expect(n.actorId).toBe(actorId);
    expect(n.entityType).toBe('member');
    expect(n.entityId).toBe(member.id);
    const payload = n.payload as Record<string, unknown>;
    expect(payload).toMatchObject({ memberId: member.id, newRole: 'member' });
  });

  it('skips the notification when actor adds themselves to a project', async () => {
    const actorEmail = (await prisma.user.findUnique({ where: { id: actorId } }))!.email;
    await projectMemberService.addMember(projectId, actorEmail, 'pm', actorId);

    const rows = await prisma.notification.findMany({
      where: { projectId, recipientId: actorId, type: 'project.member_added' },
    });
    expect(rows).toHaveLength(0);

    // Restore: remove the self-membership so subsequent tests are clean.
    await prisma.projectMember.deleteMany({
      where: { projectId, userId: actorId },
    });
  });

  it('rolling back due to ALREADY_MEMBER does NOT leave an orphan notification', async () => {
    const memberEmail = (await prisma.user.findUnique({ where: { id: recipientId } }))!
      .email;
    // First add succeeds.
    await projectMemberService.addMember(projectId, memberEmail, 'member', actorId);
    // Notif count after first add.
    const before = await prisma.notification.count({
      where: { projectId, recipientId, type: 'project.member_added' },
    });

    await expect(
      projectMemberService.addMember(projectId, memberEmail, 'member', actorId),
    ).rejects.toThrow();

    const after = await prisma.notification.count({
      where: { projectId, recipientId, type: 'project.member_added' },
    });
    expect(after).toBe(before);
  });
});
