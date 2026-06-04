import { prisma, disconnectPrisma } from '../../../../config/prisma';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

// Backfill migration `20260604xxxxxx_backfill_project_member_pm` adds a pm
// ProjectMember row for every project's createdBy user. Idempotent.
maybe('project_member backfill migration', () => {
  let userId: string;
  let projectId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `backfill-${Date.now()}@test.local`,
        name: 'Backfill Tester',
        passwordHash: 'x',
        role: 'project_manager',
      },
    });
    userId = user.id;
    const project = await prisma.project.create({
      data: {
        name: `backfill-${Date.now()}`,
        deadline: new Date(Date.now() + 86400000),
        createdBy: userId,
      },
    });
    projectId = project.id;
    // Ensure no membership row exists yet for this fresh project
    await prisma.projectMember.deleteMany({ where: { projectId } });
  });

  afterAll(async () => {
    await prisma.projectMember.deleteMany({ where: { projectId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await disconnectPrisma();
  });

  it('inserts pm member for project creator when re-run on legacy project', async () => {
    // Re-run backfill SQL (idempotent via ON CONFLICT DO NOTHING)
    await prisma.$executeRawUnsafe(`
      INSERT INTO "project_members" (id, "projectId", "userId", role, "addedAt", "addedById")
      SELECT gen_random_uuid(), p.id, p."createdBy", 'pm', p."createdAt", p."createdBy"
      FROM "projects" p
      WHERE NOT EXISTS (
        SELECT 1 FROM "project_members" pm
        WHERE pm."projectId" = p.id AND pm."userId" = p."createdBy"
      );
    `);

    const member = await prisma.projectMember.findFirst({
      where: { projectId, userId, role: 'pm' },
    });
    expect(member).not.toBeNull();
    expect(member?.addedById).toBe(userId);
  });

  it('is idempotent — second run inserts no duplicates', async () => {
    const before = await prisma.projectMember.count({ where: { projectId } });
    await prisma.$executeRawUnsafe(`
      INSERT INTO "project_members" (id, "projectId", "userId", role, "addedAt", "addedById")
      SELECT gen_random_uuid(), p.id, p."createdBy", 'pm', p."createdAt", p."createdBy"
      FROM "projects" p
      WHERE NOT EXISTS (
        SELECT 1 FROM "project_members" pm
        WHERE pm."projectId" = p.id AND pm."userId" = p."createdBy"
      );
    `);
    const after = await prisma.projectMember.count({ where: { projectId } });
    expect(after).toBe(before);
  });
});
