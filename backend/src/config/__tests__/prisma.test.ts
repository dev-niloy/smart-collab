import { prisma, disconnectPrisma } from '../prisma';

const hasDb = !!process.env.DATABASE_URL;

const maybe = hasDb ? describe : describe.skip;

maybe('prisma client smoke', () => {
  afterAll(async () => {
    await disconnectPrisma();
  });

  it('connects and executes raw SELECT 1', async () => {
    const rows: Array<{ ok: number }> = await prisma.$queryRaw`SELECT 1 as ok`;
    expect(rows[0].ok).toBe(1);
  });

  it('can count users table (schema exists)', async () => {
    const count = await prisma.user.count();
    expect(typeof count).toBe('number');
  });

  it('can count projects table (add_project migration applied)', async () => {
    const count = await prisma.project.count();
    expect(typeof count).toBe('number');
  });
});
