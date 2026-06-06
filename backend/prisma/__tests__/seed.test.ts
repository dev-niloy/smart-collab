import { prisma, disconnectPrisma } from '../../src/config/prisma';
import { seedDemoUsers } from '../seed';

const DEMO_EMAILS = ['admin@demo.local', 'pm@demo.local', 'member@demo.local'];
const DEMO_PROJECT_IDS = [
  '00000000-0000-0000-0000-00000000000a',
  '00000000-0000-0000-0000-00000000000b',
];

const cleanupDemoData = async () => {
  // Clean up children before users (FK restrict on Project.createdBy + Task.createdBy).
  await prisma.task.deleteMany({ where: { projectId: { in: DEMO_PROJECT_IDS } } });
  await prisma.activityLog.deleteMany({ where: { projectId: { in: DEMO_PROJECT_IDS } } });
  await prisma.projectMember.deleteMany({ where: { projectId: { in: DEMO_PROJECT_IDS } } });
  await prisma.project.deleteMany({ where: { id: { in: DEMO_PROJECT_IDS } } });
  await prisma.user.deleteMany({ where: { email: { in: DEMO_EMAILS } } });
};

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

maybe('prisma seed — demo users', () => {
  const ORIGINAL_ENV = process.env;

  beforeAll(() => {
    process.env = {
      ...ORIGINAL_ENV,
      DEMO_ADMIN_PW: 'test-admin-pw',
      DEMO_PM_PW: 'test-pm-pw',
      DEMO_MEMBER_PW: 'test-member-pw',
    };
  });

  afterAll(async () => {
    process.env = ORIGINAL_ENV;
    await cleanupDemoData();
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await cleanupDemoData();
  });

  it('inserts exactly 3 demo users on first run', async () => {
    await seedDemoUsers(prisma);
    const users = await prisma.user.findMany({
      where: { email: { in: DEMO_EMAILS } },
      orderBy: { email: 'asc' },
    });
    expect(users).toHaveLength(3);
    expect(users.map((u) => u.email)).toEqual(['admin@demo.local', 'member@demo.local', 'pm@demo.local']);
    expect(users.map((u) => u.role).sort()).toEqual(['admin', 'project_manager', 'team_member']);
  });

  it('is idempotent — running twice still yields exactly 3', async () => {
    await seedDemoUsers(prisma);
    await seedDemoUsers(prisma);
    const count = await prisma.user.count({ where: { email: { in: DEMO_EMAILS } } });
    expect(count).toBe(3);
  });

  it('stores bcrypt-hashed password, not plaintext', async () => {
    await seedDemoUsers(prisma);
    const admin = await prisma.user.findUnique({ where: { email: 'admin@demo.local' } });
    expect(admin).not.toBeNull();
    expect(admin!.passwordHash).not.toBe('test-admin-pw');
    expect(admin!.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('throws when a required password env var is missing', async () => {
    process.env = { ...process.env };
    delete process.env.DEMO_ADMIN_PW;
    await expect(seedDemoUsers(prisma)).rejects.toThrow(/DEMO_ADMIN_PW/);
    // restore for other tests
    process.env.DEMO_ADMIN_PW = 'test-admin-pw';
  });
});
