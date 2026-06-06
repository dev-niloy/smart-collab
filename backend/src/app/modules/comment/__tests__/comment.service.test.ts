import bcrypt from 'bcrypt';
import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { ApiError } from '../../../errors/ApiError';
import { commentService } from '../comment.service';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 7) => new Date(Date.now() + days * 86_400_000);
const tag = 'comment-svc';

maybe('commentService', () => {
  let adminId: string;
  let authorId: string;
  let strangerId: string;
  let projectId: string;
  let taskId: string;

  beforeAll(async () => {
    await prisma.activityLog.deleteMany({ where: { action: { in: ['comment.created', 'comment.deleted'] } } });
    await prisma.comment.deleteMany({ where: { body: { startsWith: tag } } });
    await prisma.task.deleteMany({ where: { title: { startsWith: tag } } });
    await prisma.project.deleteMany({ where: { name: { startsWith: tag } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });

    const admin = await prisma.user.create({
      data: { email: `${tag}-admin@t.local`, name: 'Admin', passwordHash: await bcrypt.hash('x', 4), role: 'admin' },
    });
    adminId = admin.id;
    const author = await prisma.user.create({
      data: { email: `${tag}-author@t.local`, name: 'Author', passwordHash: await bcrypt.hash('x', 4), role: 'team_member' },
    });
    authorId = author.id;
    const stranger = await prisma.user.create({
      data: { email: `${tag}-stranger@t.local`, name: 'Stranger', passwordHash: await bcrypt.hash('x', 4), role: 'team_member' },
    });
    strangerId = stranger.id;

    const p = await prisma.project.create({
      data: { name: `${tag} Proj`, deadline: future(30), status: 'active', createdBy: adminId },
    });
    projectId = p.id;

    const t = await prisma.task.create({
      data: { projectId, title: `${tag} task`, dueDate: future(), createdBy: adminId },
    });
    taskId = t.id;
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { entityType: 'comment' } });
    await prisma.comment.deleteMany({ where: { taskId } });
    await prisma.task.deleteMany({ where: { id: taskId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, authorId, strangerId] } } });
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await prisma.activityLog.deleteMany({ where: { entityType: 'comment' } });
    await prisma.comment.deleteMany({ where: { taskId } });
  });

  it('create returns DTO and emits comment.created activity', async () => {
    const dto = await commentService.create(taskId, authorId, `${tag} first`);
    expect(dto.id).toBeTruthy();
    expect(dto.taskId).toBe(taskId);
    expect(dto.body).toBe(`${tag} first`);
    expect(dto.author).toEqual({ id: authorId, name: 'Author' });

    const acts = await prisma.activityLog.findMany({ where: { entityId: dto.id, action: 'comment.created' } });
    expect(acts.length).toBe(1);
    expect(acts[0].projectId).toBe(projectId);
    expect(acts[0].actorId).toBe(authorId);
  });

  it('create throws 404 when task missing', async () => {
    await expect(
      commentService.create('00000000-0000-0000-0000-000000000000', authorId, 'orphan'),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('list returns newest first with nextCursor when over limit', async () => {
    for (let i = 0; i < 3; i += 1) {
      await commentService.create(taskId, authorId, `${tag} body ${i}`);
      await new Promise((r) => setTimeout(r, 5));
    }
    const page1 = await commentService.list(taskId, { limit: 2 });
    expect(page1.items.length).toBe(2);
    expect(page1.items[0].body).toBe(`${tag} body 2`);
    expect(page1.items[1].body).toBe(`${tag} body 1`);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = await commentService.list(taskId, { limit: 2, cursor: page1.nextCursor! });
    expect(page2.items.length).toBe(1);
    expect(page2.items[0].body).toBe(`${tag} body 0`);
    expect(page2.nextCursor).toBeNull();
  });

  it('update by author succeeds', async () => {
    const created = await commentService.create(taskId, authorId, `${tag} edit me`);
    const updated = await commentService.update(
      created.id,
      { id: authorId, role: 'team_member' },
      `${tag} edited body`,
    );
    expect(updated.body).toBe(`${tag} edited body`);
  });

  it('update by system admin succeeds even on stranger comment', async () => {
    const created = await commentService.create(taskId, authorId, `${tag} admin will edit`);
    const updated = await commentService.update(
      created.id,
      { id: adminId, role: 'admin' },
      `${tag} admin edited`,
    );
    expect(updated.body).toBe(`${tag} admin edited`);
  });

  it('update by stranger throws 403', async () => {
    const created = await commentService.create(taskId, authorId, `${tag} no touchy`);
    await expect(
      commentService.update(created.id, { id: strangerId, role: 'team_member' }, 'hax'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('delete by author emits comment.deleted and removes row', async () => {
    const created = await commentService.create(taskId, authorId, `${tag} delete me`);
    await commentService.remove(created.id, { id: authorId, role: 'team_member' }, 'member');
    const found = await prisma.comment.findUnique({ where: { id: created.id } });
    expect(found).toBeNull();
    const acts = await prisma.activityLog.findMany({ where: { entityId: created.id, action: 'comment.deleted' } });
    expect(acts.length).toBe(1);
  });

  it('delete by PM (non-author) succeeds; stranger member 403', async () => {
    const created = await commentService.create(taskId, authorId, `${tag} pm delete`);
    await commentService.remove(created.id, { id: strangerId, role: 'team_member' }, 'pm');
    const found = await prisma.comment.findUnique({ where: { id: created.id } });
    expect(found).toBeNull();

    const another = await commentService.create(taskId, authorId, `${tag} stranger denied`);
    await expect(
      commentService.remove(another.id, { id: strangerId, role: 'team_member' }, 'member'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
