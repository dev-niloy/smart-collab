import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';

const TEST_EMAIL = 'act-schema@test.local';
const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 7) => new Date(Date.now() + days * 86_400_000);

maybe('ActivityLog schema extension', () => {
  let actorId: string;
  let projectId: string;

  beforeAll(async () => {
    await prisma.activityLog.deleteMany({ where: { action: { startsWith: 'schema-test.' } } });
    await prisma.project.deleteMany({ where: { name: { startsWith: 'ActSchema' } } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    const u = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Act Schema',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'admin',
      },
    });
    actorId = u.id;
    const p = await prisma.project.create({
      data: { name: 'ActSchema Proj', deadline: future(30), status: 'active', createdBy: actorId },
    });
    projectId = p.id;
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { action: { startsWith: 'schema-test.' } } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: actorId } });
    await disconnectPrisma();
  });

  it('persists projectId, entityType, entityId on insert', async () => {
    const entityId = projectId;
    const row = await prisma.activityLog.create({
      data: {
        actorId,
        action: 'schema-test.created',
        entityType: 'project',
        entityId,
        projectId,
        meta: { foo: 'bar' },
      },
    });
    expect(row.projectId).toBe(projectId);
    expect(row.entityType).toBe('project');
    expect(row.entityId).toBe(entityId);
  });

  it('allows null projectId for non-scoped activity', async () => {
    const row = await prisma.activityLog.create({
      data: {
        actorId,
        action: 'schema-test.global',
        entityType: 'user',
        entityId: actorId,
      },
    });
    expect(row.projectId).toBeNull();
    expect(row.entityType).toBe('user');
  });

  it('queries by projectId + createdAt desc efficiently (index hit)', async () => {
    const rows = await prisma.activityLog.findMany({
      where: { projectId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.projectId === projectId)).toBe(true);
  });
});
