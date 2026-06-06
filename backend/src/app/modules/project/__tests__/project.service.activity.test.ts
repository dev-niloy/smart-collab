import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { projectService } from '../project.service';

const TEST_EMAIL = 'proj-act@test.local';
const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 7) => new Date(Date.now() + days * 86_400_000);

maybe('project.service activity emissions', () => {
  let actorId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    const u = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Proj Act',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'admin',
      },
    });
    actorId = u.id;
  });

  beforeEach(async () => {
    await prisma.activityLog.deleteMany({ where: { actorId } });
    await prisma.project.deleteMany({ where: { name: { startsWith: 'ProjAct' } } });
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { actorId } });
    await prisma.project.deleteMany({ where: { name: { startsWith: 'ProjAct' } } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await disconnectPrisma();
  });

  it('emits project.created on create', async () => {
    const p = await projectService.create(
      { name: 'ProjAct One', deadline: future(10), status: 'active' } as any,
      actorId,
    );
    const log = await prisma.activityLog.findFirst({
      where: { action: 'project.created', entityId: p.id },
    });
    expect(log).not.toBeNull();
    expect(log!.projectId).toBe(p.id);
    expect(log!.entityType).toBe('project');
  });

  it('emits project.updated on update', async () => {
    const p = await projectService.create(
      { name: 'ProjAct Two', deadline: future(10), status: 'active' } as any,
      actorId,
    );
    await projectService.update(p.id, { name: 'ProjAct Two Renamed' } as any, actorId);
    const log = await prisma.activityLog.findFirst({
      where: { action: 'project.updated', entityId: p.id },
    });
    expect(log).not.toBeNull();
    const meta = log!.meta as Record<string, unknown>;
    expect(meta.name).toBe('ProjAct Two Renamed');
  });

  it('emits project.deleted on delete', async () => {
    const p = await projectService.create(
      { name: 'ProjAct Three', deadline: future(10), status: 'active' } as any,
      actorId,
    );
    await projectService.remove(p.id, actorId);
    const log = await prisma.activityLog.findFirst({
      where: { action: 'project.deleted', entityId: p.id },
    });
    expect(log).not.toBeNull();
  });

  it('preserves existing create return shape', async () => {
    const p = await projectService.create(
      { name: 'ProjAct Four', deadline: future(10), status: 'active' } as any,
      actorId,
    );
    expect(p.id).toBeDefined();
    expect(p.creator).toBeDefined();
    expect(p.creator.id).toBe(actorId);
  });
});
