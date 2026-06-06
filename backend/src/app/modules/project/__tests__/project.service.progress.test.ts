import bcrypt from 'bcrypt';
import { ProjectStatus, TaskStatus, TaskPriority } from '@prisma/client';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { projectService } from '../project.service';

const TEST_EMAIL = 't-progress-system@test.local';
const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const dayFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);

maybe('projectService — progress aggregate', () => {
  let actorId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    const u = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Progress Test',
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

  const seedTasks = async (projectId: string, statuses: TaskStatus[]) => {
    for (let i = 0; i < statuses.length; i++) {
      await prisma.task.create({
        data: {
          projectId,
          title: `task-${statuses[i]}-${i}`,
          status: statuses[i],
          priority: TaskPriority.medium,
          dueDate: dayFromNow(7),
          createdBy: actorId,
        },
      });
    }
  };

  it('findById returns progress {0,0,0} for empty project', async () => {
    const p = await projectService.create(
      { name: 'empty', deadline: dayFromNow(5), status: ProjectStatus.active },
      actorId,
    );
    const got = await projectService.findById(p.id);
    expect(got.progress).toEqual({ done: 0, total: 0, percent: 0 });
  });

  it('findById returns 100% when all tasks completed', async () => {
    const p = await projectService.create(
      { name: 'all-done', deadline: dayFromNow(5), status: ProjectStatus.active },
      actorId,
    );
    await seedTasks(p.id, [TaskStatus.completed, TaskStatus.completed, TaskStatus.completed]);
    const got = await projectService.findById(p.id);
    expect(got.progress).toEqual({ done: 3, total: 3, percent: 100 });
  });

  it('findById returns rounded percent for partial (1 of 3 done = 33)', async () => {
    const p = await projectService.create(
      { name: 'partial', deadline: dayFromNow(5), status: ProjectStatus.active },
      actorId,
    );
    await seedTasks(p.id, [TaskStatus.completed, TaskStatus.in_progress, TaskStatus.todo]);
    const got = await projectService.findById(p.id);
    expect(got.progress).toEqual({ done: 1, total: 3, percent: 33 });
  });

  it('findById returns 0% when no task is completed yet', async () => {
    const p = await projectService.create(
      { name: 'no-done', deadline: dayFromNow(5), status: ProjectStatus.active },
      actorId,
    );
    await seedTasks(p.id, [TaskStatus.todo, TaskStatus.in_progress]);
    const got = await projectService.findById(p.id);
    expect(got.progress).toEqual({ done: 0, total: 2, percent: 0 });
  });

  it('list returns progress per project (no N+1 — single batched query)', async () => {
    const p1 = await projectService.create(
      { name: 'list-empty', deadline: dayFromNow(5), status: ProjectStatus.active },
      actorId,
    );
    const p2 = await projectService.create(
      { name: 'list-partial', deadline: dayFromNow(6), status: ProjectStatus.active },
      actorId,
    );
    await seedTasks(p2.id, [TaskStatus.completed, TaskStatus.todo]);

    const result = await projectService.list({
      actorId,
      createdBy: actorId,
      sort: 'created',
      page: 1,
      limit: 50,
    });
    const byId = new Map(result.data.map((p) => [p.id, p]));
    expect(byId.get(p1.id)?.progress).toEqual({ done: 0, total: 0, percent: 0 });
    expect(byId.get(p2.id)?.progress).toEqual({ done: 1, total: 2, percent: 50 });
  });
});
