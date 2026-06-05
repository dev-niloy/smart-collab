import bcrypt from 'bcrypt';
import { ProjectStatus, Role } from '@prisma/client';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { ApiError } from '../../../errors/ApiError';
import { projectService } from '../project.service';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;
const dayFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

const ADMIN_EMAIL = 't-rbac-admin@test.local';
const PM1_EMAIL = 't-rbac-pm1@test.local';
const PM2_EMAIL = 't-rbac-pm2@test.local';
const MEMBER_EMAIL = 't-rbac-member@test.local';

maybe('projectService — RBAC scoping (member-visibility)', () => {
  let adminId: string;
  let pm1Id: string;
  let pm2Id: string;
  let memberId: string;
  let projA: string; // creator pm1 — pm1 auto-pm; admin can see; pm2 + member cannot
  let projB: string; // creator pm2 — pm2 auto-pm; admin can see; pm1 + member cannot

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
    await prisma.project.deleteMany({ where: { createdBy: { in: [pm1Id, pm2Id, adminId] } } });
    await prisma.user.deleteMany({
      where: { email: { in: [ADMIN_EMAIL, PM1_EMAIL, PM2_EMAIL, MEMBER_EMAIL] } },
    });
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await prisma.project.deleteMany({ where: { createdBy: { in: [pm1Id, pm2Id, adminId] } } });
    const a = await projectService.create(
      { name: 'rbac-A', deadline: dayFromNow(5), status: ProjectStatus.active },
      pm1Id,
    );
    const b = await projectService.create(
      { name: 'rbac-B', deadline: dayFromNow(5), status: ProjectStatus.active },
      pm2Id,
    );
    projA = a.id;
    projB = b.id;
  });

  const listAs = (id: string, role: Role) =>
    projectService.list({
      sort: 'created',
      page: 1,
      limit: 50,
      actor: { id, role },
    });

  describe('list', () => {
    it('admin sees all projects', async () => {
      const r = await listAs(adminId, Role.admin);
      const names = r.data.map((p) => p.name).sort();
      expect(names).toEqual(expect.arrayContaining(['rbac-A', 'rbac-B']));
    });

    it('pm1 sees only their own project (creator auto-pm)', async () => {
      const r = await listAs(pm1Id, Role.project_manager);
      const names = r.data.map((p) => p.name);
      expect(names).toContain('rbac-A');
      expect(names).not.toContain('rbac-B');
    });

    it('pm2 sees only their own project', async () => {
      const r = await listAs(pm2Id, Role.project_manager);
      const names = r.data.map((p) => p.name);
      expect(names).toContain('rbac-B');
      expect(names).not.toContain('rbac-A');
    });

    it('team_member not in any project sees empty list', async () => {
      const r = await listAs(memberId, Role.team_member);
      const names = r.data.map((p) => p.name);
      expect(names).not.toContain('rbac-A');
      expect(names).not.toContain('rbac-B');
    });

    it('team_member added to a project sees it', async () => {
      await prisma.projectMember.create({
        data: { projectId: projA, userId: memberId, role: 'member', addedById: pm1Id },
      });
      const r = await listAs(memberId, Role.team_member);
      const names = r.data.map((p) => p.name);
      expect(names).toEqual(['rbac-A']);
    });
  });

  describe('findById', () => {
    it('admin can read any project', async () => {
      const p = await projectService.findById(projB, { id: adminId, role: Role.admin });
      expect(p.id).toBe(projB);
    });

    it('member-creator (auto-pm) can read their own project', async () => {
      const p = await projectService.findById(projA, { id: pm1Id, role: Role.project_manager });
      expect(p.id).toBe(projA);
    });

    it('non-member pm gets 403 FORBIDDEN', async () => {
      await expect(
        projectService.findById(projB, { id: pm1Id, role: Role.project_manager }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('non-member team_member gets 403 FORBIDDEN', async () => {
      await expect(
        projectService.findById(projA, { id: memberId, role: Role.team_member }),
      ).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN',
      });
    });

    it('explicitly-added team_member can read', async () => {
      await prisma.projectMember.create({
        data: { projectId: projB, userId: memberId, role: 'member', addedById: pm2Id },
      });
      const p = await projectService.findById(projB, { id: memberId, role: Role.team_member });
      expect(p.id).toBe(projB);
    });

    it('still throws NOT_FOUND when id is bogus regardless of role', async () => {
      const bogus = '00000000-0000-0000-0000-000000000000';
      await expect(
        projectService.findById(bogus, { id: adminId, role: Role.admin }),
      ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
    });
  });

  it('ApiError import is wired correctly (sanity)', () => {
    const e = ApiError.forbidden();
    expect(e.statusCode).toBe(403);
  });
});
