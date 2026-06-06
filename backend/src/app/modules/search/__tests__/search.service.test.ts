import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { search } from '../search.service';

const TEST_EMAIL = 'search-svc@test.local';
const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 7) => new Date(Date.now() + days * 86_400_000);

maybe('search.service', () => {
  let actorId: string;
  let projectFoo: string;
  let projectBar: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    const u = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Search Svc',
        passwordHash: await bcrypt.hash('x', 4),
        role: 'admin',
      },
    });
    actorId = u.id;

    await prisma.project.deleteMany({ where: { name: { startsWith: 'SearchSvc' } } });

    const pFoo = await prisma.project.create({
      data: {
        name: 'SearchSvc Alpha',
        description: 'foo project',
        deadline: future(30),
        createdBy: actorId,
      },
    });
    projectFoo = pFoo.id;
    const pBar = await prisma.project.create({
      data: {
        name: 'SearchSvc Beta',
        description: 'no match here',
        deadline: future(30),
        createdBy: actorId,
      },
    });
    projectBar = pBar.id;
    // Extra project with prefix match for ranking test
    await prisma.project.create({
      data: {
        name: 'SearchSvc foo prefix',
        deadline: future(30),
        createdBy: actorId,
      },
    });

    await prisma.task.create({
      data: {
        projectId: projectFoo,
        title: 'fix foo bar',
        description: 'task in foo',
        dueDate: future(5),
        createdBy: actorId,
      },
    });
    await prisma.task.create({
      data: {
        projectId: projectBar,
        title: 'rebuild api',
        description: 'mention foo here',
        dueDate: future(5),
        createdBy: actorId,
      },
    });
  });

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { project: { name: { startsWith: 'SearchSvc' } } } });
    await prisma.project.deleteMany({ where: { name: { startsWith: 'SearchSvc' } } });
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await disconnectPrisma();
  });

  it('finds project by name substring', async () => {
    const r = await search({ q: 'Alpha' });
    expect(r.projects.some((p) => p.id === projectFoo)).toBe(true);
  });

  it('finds project by description', async () => {
    const r = await search({ q: 'foo project' });
    expect(r.projects.some((p) => p.id === projectFoo)).toBe(true);
  });

  it('finds task by title substring (case-insensitive)', async () => {
    const r = await search({ q: 'FOO BAR' });
    expect(r.tasks.some((t) => t.title === 'fix foo bar')).toBe(true);
  });

  it('finds task by description', async () => {
    const r = await search({ q: 'mention foo' });
    expect(r.tasks.some((t) => t.title === 'rebuild api')).toBe(true);
  });

  it('respects limit (default 5)', async () => {
    const r = await search({ q: 'SearchSvc' });
    expect(r.projects.length).toBeLessThanOrEqual(5);
  });

  it('honours explicit limit override', async () => {
    const r = await search({ q: 'SearchSvc', limit: 1 });
    expect(r.projects.length).toBe(1);
  });

  it('returns empty arrays for no match', async () => {
    const r = await search({ q: 'absolutely-no-such-string' });
    expect(r.projects).toEqual([]);
    expect(r.tasks).toEqual([]);
  });

  it('orders prefix-match before contains-match on project name', async () => {
    const r = await search({ q: 'foo' });
    const names = r.projects.map((p) => p.name.toLowerCase());
    const prefixIdx = names.findIndex((n) => n.startsWith('foo'));
    const containsIdx = names.findIndex((n) => !n.startsWith('foo') && n.includes('foo'));
    if (prefixIdx >= 0 && containsIdx >= 0) {
      expect(prefixIdx).toBeLessThan(containsIdx);
    }
  });

  it('description-only match still surfaces when title matches exist', async () => {
    // Seed an extra task whose title does NOT contain the needle but whose
    // description does. With the old ranking it would score Infinity and get
    // dropped from the slice. After the fix it should still appear.
    await prisma.task.create({
      data: {
        projectId: projectFoo,
        title: 'unrelated headline',
        description: 'this body mentions foo somewhere',
        dueDate: future(5),
        createdBy: actorId,
      },
    });
    const r = await search({ q: 'foo', limit: 5 });
    expect(r.tasks.some((t) => t.title === 'unrelated headline')).toBe(true);
  });

  it('returns required DTO fields on task hits incl projectName', async () => {
    const r = await search({ q: 'fix foo' });
    const hit = r.tasks.find((t) => t.title === 'fix foo bar');
    expect(hit).toBeDefined();
    expect(hit!.projectId).toBe(projectFoo);
    expect(hit!.projectName).toBe('SearchSvc Alpha');
    expect(hit!.status).toBeDefined();
    expect(hit!.priority).toBeDefined();
    expect(hit!.dueDate).toBeInstanceOf(Date);
  });
});
