import bcrypt from 'bcrypt';
import { ProjectStatus } from '@prisma/client';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { projectService } from '../project.service';

const TEST_EMAIL = 't5-project-list@test.local';
const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const dayFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

maybe('projectService.list', () => {
  let actorId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    const u = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'List Test',
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
    // Seed 5 projects with mixed status + spread deadlines/createdAt
    await projectService.create(
      { name: 'Website Redesign', deadline: dayFromNow(10), status: ProjectStatus.active },
      actorId,
    );
    await projectService.create(
      { name: 'Mobile App', deadline: dayFromNow(5), status: ProjectStatus.completed },
      actorId,
    );
    await projectService.create(
      { name: 'Admin Dashboard', deadline: dayFromNow(2), status: ProjectStatus.on_hold },
      actorId,
    );
    await projectService.create(
      { name: 'API Migration', deadline: dayFromNow(20), status: ProjectStatus.active },
      actorId,
    );
    await projectService.create(
      { name: 'Website Audit', deadline: dayFromNow(8), status: ProjectStatus.active },
      actorId,
    );
  });

  const myList = (overrides: Partial<Parameters<typeof projectService.list>[0]> = {}) =>
    projectService.list({
      sort: 'created',
      page: 1,
      limit: 10,
      ...overrides,
      ...{ q: overrides.q ?? undefined, status: overrides.status ?? undefined },
    });

  const onlyMine = async (rows: Awaited<ReturnType<typeof projectService.list>>['data']) =>
    rows.filter((r) => r.createdBy === actorId);

  it('returns total + data + page + limit', async () => {
    const r = await myList();
    expect(r.page).toBe(1);
    expect(r.limit).toBe(10);
    expect(typeof r.total).toBe('number');
    const mine = await onlyMine(r.data);
    expect(mine.length).toBe(5);
  });

  it('filters by status', async () => {
    const r = await myList({ status: ProjectStatus.active });
    const mine = await onlyMine(r.data);
    expect(mine.every((p) => p.status === 'active')).toBe(true);
    expect(mine.length).toBe(3);
  });

  it('case-insensitive search by name (contains)', async () => {
    const r = await myList({ q: 'website' });
    const mine = await onlyMine(r.data);
    expect(mine.length).toBe(2);
    expect(mine.every((p) => /website/i.test(p.name))).toBe(true);
  });

  it('combines q + status', async () => {
    const r = await myList({ q: 'website', status: ProjectStatus.active });
    const mine = await onlyMine(r.data);
    expect(mine.length).toBe(2);
  });

  it('sort=deadline orders nearest-deadline first within result', async () => {
    const r = await myList({ sort: 'deadline' });
    const mine = await onlyMine(r.data);
    for (let i = 1; i < mine.length; i++) {
      expect(mine[i - 1].deadline.getTime()).toBeLessThanOrEqual(mine[i].deadline.getTime());
    }
  });

  it('pagination: limit=2 page=2 returns next slice', async () => {
    // Restrict to mine via status filter (3 active rows)
    const p1 = await myList({ status: ProjectStatus.active, limit: 2, page: 1, sort: 'deadline' });
    const p2 = await myList({ status: ProjectStatus.active, limit: 2, page: 2, sort: 'deadline' });
    const mine1 = await onlyMine(p1.data);
    const mine2 = await onlyMine(p2.data);
    expect(mine1.length).toBe(2);
    expect(mine2.length).toBe(1);
    const idsP1 = new Set(mine1.map((p) => p.id));
    expect(mine2.some((p) => idsP1.has(p.id))).toBe(false);
  });

  it('returns empty data when no match', async () => {
    const r = await myList({ q: 'no-such-project-name-anywhere' });
    const mine = await onlyMine(r.data);
    expect(mine).toEqual([]);
  });
});
