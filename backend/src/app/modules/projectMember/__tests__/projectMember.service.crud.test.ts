import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { projectMemberService } from '../projectMember.service';
import { ApiError } from '../../../errors/ApiError';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 30) => new Date(Date.now() + days * 86_400_000);
const u = (label: string) => `pm-svc-${label}-${Date.now()}@test.local`;

maybe('projectMemberService — add / isMember / getProjectRole / listAssignable', () => {
  let actorId: string;
  let memberUserId: string;
  let adminUserId: string;
  let projectId: string;
  let otherProjectId: string;
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

    const member = await prisma.user.create({
      data: {
        email: u('member'),
        name: 'Member User',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'team_member',
      },
    });
    memberUserId = member.id;
    cleanupUserIds.push(memberUserId);

    const admin = await prisma.user.create({
      data: {
        email: u('admin'),
        name: 'Admin User',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'admin',
      },
    });
    adminUserId = admin.id;
    cleanupUserIds.push(adminUserId);

    const p = await prisma.project.create({
      data: { name: `pm-svc-${Date.now()}`, deadline: future(), createdBy: actorId },
    });
    projectId = p.id;
    cleanupProjectIds.push(projectId);

    const p2 = await prisma.project.create({
      data: { name: `pm-svc-other-${Date.now()}`, deadline: future(), createdBy: actorId },
    });
    otherProjectId = p2.id;
    cleanupProjectIds.push(otherProjectId);
  });

  afterAll(async () => {
    await prisma.projectMember.deleteMany({
      where: { projectId: { in: cleanupProjectIds } },
    });
    await prisma.project.deleteMany({ where: { id: { in: cleanupProjectIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    await disconnectPrisma();
  });

  describe('addMember', () => {
    it('inserts a member row + returns user echo', async () => {
      const out = await projectMemberService.addMember(
        projectId,
        (await prisma.user.findUniqueOrThrow({ where: { id: memberUserId } })).email,
        'member',
        actorId,
      );
      expect(out.userId).toBe(memberUserId);
      expect(out.role).toBe('member');
      expect(out.user.email).toMatch(/pm-svc-member/);
      expect(out.user).not.toHaveProperty('passwordHash');
    });

    it('returns ApiError 404 USER_NOT_FOUND on unknown email', async () => {
      await expect(
        projectMemberService.addMember(projectId, 'nope@nowhere.test', 'member', actorId),
      ).rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
    });

    it('returns ApiError 422 ALREADY_MEMBER on duplicate', async () => {
      const memberEmail = (await prisma.user.findUniqueOrThrow({ where: { id: memberUserId } })).email;
      await expect(
        projectMemberService.addMember(projectId, memberEmail, 'member', actorId),
      ).rejects.toMatchObject({ statusCode: 422, code: 'ALREADY_MEMBER' });
    });

    it('returns ApiError 404 PROJECT_NOT_FOUND on unknown project', async () => {
      await expect(
        projectMemberService.addMember(
          '00000000-0000-4000-8000-000000000000',
          'whoever@test.local',
          'member',
          actorId,
        ),
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('isMember / getProjectRole', () => {
    it('isMember true for actor (auto-pm) and added member', async () => {
      // actor — created project, no auto-PM logic yet (t12); add explicitly
      await prisma.projectMember.upsert({
        where: { project_members_project_user_unique: { projectId, userId: actorId } },
        create: { projectId, userId: actorId, role: 'pm', addedById: actorId },
        update: {},
      });
      expect(await projectMemberService.isMember(projectId, actorId)).toBe(true);
      expect(await projectMemberService.isMember(projectId, memberUserId)).toBe(true);
    });

    it('isMember false for unrelated user', async () => {
      expect(await projectMemberService.isMember(projectId, adminUserId)).toBe(false);
    });

    it('getProjectRole returns role for member', async () => {
      expect(await projectMemberService.getProjectRole(projectId, actorId)).toBe('pm');
      expect(await projectMemberService.getProjectRole(projectId, memberUserId)).toBe('member');
    });

    it('getProjectRole returns null for non-member', async () => {
      expect(await projectMemberService.getProjectRole(projectId, adminUserId)).toBeNull();
    });
  });

  describe('listAssignable', () => {
    it('returns project members + system admins, deduped', async () => {
      const out = await projectMemberService.listAssignable(projectId);
      const ids = out.map((e) => e.id);
      expect(ids).toContain(actorId);
      expect(ids).toContain(memberUserId);
      expect(ids).toContain(adminUserId);
      // No duplicates
      expect(new Set(ids).size).toBe(ids.length);
      // Admin entry tagged as admin projectRole
      const adminEntry = out.find((e) => e.id === adminUserId);
      expect(adminEntry?.projectRole).toBe('admin');
    });

    it('only includes members from the queried project (other projects excluded)', async () => {
      // Add member to OTHER project; should not appear in this list
      await prisma.projectMember.create({
        data: { projectId: otherProjectId, userId: memberUserId, role: 'member', addedById: actorId },
      });
      const here = await projectMemberService.listAssignable(projectId);
      const there = await projectMemberService.listAssignable(otherProjectId);
      // memberUserId appears in both, but as derived from each project's own row
      expect(here.find((e) => e.id === memberUserId)?.projectRole).toBe('member');
      expect(there.find((e) => e.id === memberUserId)?.projectRole).toBe('member');
      // actor is NOT a member of otherProjectId — but is admin? No, project_manager.
      // So actor should not appear in `there` listAssignable.
      expect(there.find((e) => e.id === actorId)).toBeUndefined();
    });
  });
});
