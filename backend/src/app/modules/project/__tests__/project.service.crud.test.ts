import bcrypt from 'bcrypt';
import { ProjectStatus } from '@prisma/client';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { projectService } from '../project.service';
import { ApiError } from '../../../errors/ApiError';
import { PAST_DEADLINE_MESSAGE } from '../project.constant';

const TEST_EMAIL = 't4-project-svc@test.local';
const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = () => new Date(Date.now() + 86_400_000);
const past = () => new Date(Date.now() - 86_400_000);

maybe('projectService CRUD', () => {
  let actorId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    const u = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Service Test',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'admin',
      },
    });
    actorId = u.id;
  });

  afterAll(async () => {
    await prisma.project.deleteMany({ where: { createdBy: actorId } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await prisma.project.deleteMany({ where: { createdBy: actorId } });
  });

  describe('create', () => {
    it('inserts row with createdBy + default active status', async () => {
      const p = await projectService.create(
        { name: 'Site Redesign', deadline: future(), description: 'desc', status: ProjectStatus.active },
        actorId,
      );
      expect(p.id).toBeTruthy();
      expect(p.createdBy).toBe(actorId);
      expect(p.status).toBe('active');
      expect(p.name).toBe('Site Redesign');
    });

    it('rejects past deadline with 422 + assessment-verbatim message', async () => {
      await expect(
        projectService.create(
          { name: 'X', deadline: past(), status: ProjectStatus.active },
          actorId,
        ),
      ).rejects.toMatchObject({ statusCode: 422, code: 'PAST_DEADLINE', message: PAST_DEADLINE_MESSAGE });
    });

    it('throws ApiError instance on past deadline', async () => {
      await expect(
        projectService.create({ name: 'X', deadline: past(), status: ProjectStatus.active }, actorId),
      ).rejects.toThrow(ApiError);
    });

    it('auto-inserts creator as pm ProjectMember in same tx', async () => {
      const p = await projectService.create(
        { name: 'Auto-PM', deadline: future(), status: ProjectStatus.active },
        actorId,
      );
      const mem = await prisma.projectMember.findFirst({
        where: { projectId: p.id, userId: actorId },
      });
      expect(mem).not.toBeNull();
      expect(mem?.role).toBe('pm');
      expect(mem?.addedById).toBe(actorId);
    });
  });

  describe('findById', () => {
    it('returns project when present', async () => {
      const created = await projectService.create(
        { name: 'A', deadline: future(), status: ProjectStatus.active },
        actorId,
      );
      const fetched = await projectService.findById(created.id);
      expect(fetched.id).toBe(created.id);
    });

    it('throws 404 when missing', async () => {
      await expect(
        projectService.findById('00000000-0000-0000-0000-000000000000'),
      ).rejects.toMatchObject({ statusCode: 404, code: 'PROJECT_NOT_FOUND' });
    });
  });

  describe('update', () => {
    it('patches fields', async () => {
      const created = await projectService.create(
        { name: 'A', deadline: future(), status: ProjectStatus.active },
        actorId,
      );
      const updated = await projectService.update(created.id, {
        name: 'A renamed',
        status: ProjectStatus.completed,
      });
      expect(updated.name).toBe('A renamed');
      expect(updated.status).toBe('completed');
    });

    it('404 when id missing', async () => {
      await expect(
        projectService.update('00000000-0000-0000-0000-000000000000', { name: 'x' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('rejects past deadline on update', async () => {
      const created = await projectService.create(
        { name: 'A', deadline: future(), status: ProjectStatus.active },
        actorId,
      );
      await expect(
        projectService.update(created.id, { deadline: past() }),
      ).rejects.toMatchObject({ statusCode: 422, code: 'PAST_DEADLINE' });
    });
  });

  describe('remove', () => {
    it('deletes the row', async () => {
      const created = await projectService.create(
        { name: 'A', deadline: future(), status: ProjectStatus.active },
        actorId,
      );
      await projectService.remove(created.id);
      const after = await prisma.project.findUnique({ where: { id: created.id } });
      expect(after).toBeNull();
    });

    it('404 when removing missing id', async () => {
      await expect(
        projectService.remove('00000000-0000-0000-0000-000000000000'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
