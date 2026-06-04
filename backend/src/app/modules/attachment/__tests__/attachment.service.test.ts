import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import bcrypt from 'bcrypt';

const TMP_UPLOAD_DIR = path.join(os.tmpdir(), `extras-uploads-${process.pid}`);
process.env.UPLOAD_DIR = TMP_UPLOAD_DIR;

import { prisma, disconnectPrisma } from '../../../../config/prisma';
import { attachmentService } from '../attachment.service';

const hasDb = !!process.env.DATABASE_URL;
const maybe = hasDb ? describe : describe.skip;

const future = (days = 7) => new Date(Date.now() + days * 86_400_000);
const tag = 'att-svc';

maybe('attachmentService', () => {
  let adminId: string;
  let uploaderId: string;
  let strangerId: string;
  let projectId: string;
  let taskId: string;

  beforeAll(async () => {
    await fsp.mkdir(TMP_UPLOAD_DIR, { recursive: true });
    await prisma.activityLog.deleteMany({ where: { entityType: 'attachment' } });
    await prisma.attachment.deleteMany({ where: { filename: { startsWith: tag } } });
    await prisma.task.deleteMany({ where: { title: { startsWith: tag } } });
    await prisma.project.deleteMany({ where: { name: { startsWith: tag } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: tag } } });

    adminId = (await prisma.user.create({
      data: { email: `${tag}-admin@t.local`, name: 'Adm', passwordHash: await bcrypt.hash('x', 4), role: 'admin' },
    })).id;
    uploaderId = (await prisma.user.create({
      data: { email: `${tag}-up@t.local`, name: 'Up', passwordHash: await bcrypt.hash('x', 4), role: 'team_member' },
    })).id;
    strangerId = (await prisma.user.create({
      data: { email: `${tag}-stranger@t.local`, name: 'Str', passwordHash: await bcrypt.hash('x', 4), role: 'team_member' },
    })).id;

    projectId = (await prisma.project.create({
      data: { name: `${tag} Proj`, deadline: future(30), status: 'active', createdBy: adminId },
    })).id;
    taskId = (await prisma.task.create({
      data: { projectId, title: `${tag} task`, dueDate: future(), createdBy: adminId },
    })).id;
  });

  afterAll(async () => {
    await prisma.activityLog.deleteMany({ where: { entityType: 'attachment' } });
    await prisma.attachment.deleteMany({ where: { taskId } });
    await prisma.task.deleteMany({ where: { id: taskId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.user.deleteMany({ where: { id: { in: [adminId, uploaderId, strangerId] } } });
    await fsp.rm(TMP_UPLOAD_DIR, { recursive: true, force: true });
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await prisma.activityLog.deleteMany({ where: { entityType: 'attachment' } });
    await prisma.attachment.deleteMany({ where: { taskId } });
  });

  it('upload writes file + row + emits attachment.added', async () => {
    const buf = Buffer.from(`${tag} payload`);
    const dto = await attachmentService.upload(taskId, uploaderId, {
      originalName: `${tag}-doc.pdf`,
      mimeType: 'application/pdf',
      sizeBytes: buf.length,
      buffer: buf,
    });
    expect(dto.id).toBeTruthy();
    expect(dto.filename).toBe(`${tag}-doc.pdf`);
    const acts = await prisma.activityLog.findMany({ where: { entityId: dto.id, action: 'attachment.added' } });
    expect(acts.length).toBe(1);
    // file persisted to disk
    const row = await prisma.attachment.findUniqueOrThrow({ where: { id: dto.id } });
    const abs = path.join(TMP_UPLOAD_DIR, row.storagePath);
    expect(fs.existsSync(abs)).toBe(true);
    expect((await fsp.readFile(abs)).toString()).toBe(`${tag} payload`);
  });

  it('list returns metadata only and no streams', async () => {
    const buf = Buffer.from('hello');
    await attachmentService.upload(taskId, uploaderId, {
      originalName: `${tag}-list.txt`,
      mimeType: 'text/plain',
      sizeBytes: buf.length,
      buffer: buf,
    });
    const rows = await attachmentService.list(taskId);
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ filename: `${tag}-list.txt`, mimeType: 'text/plain' });
    expect((rows[0] as Record<string, unknown>).storagePath).toBeUndefined();
    expect((rows[0] as Record<string, unknown>).buffer).toBeUndefined();
  });

  it('upload rolls back row + unlinks file when DB tx fails (bad taskId)', async () => {
    const before = await fsp.readdir(TMP_UPLOAD_DIR);
    await expect(
      attachmentService.upload('00000000-0000-0000-0000-000000000000', uploaderId, {
        originalName: `${tag}-orphan.txt`,
        mimeType: 'text/plain',
        sizeBytes: 5,
        buffer: Buffer.from('hello'),
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    const after = await fsp.readdir(TMP_UPLOAD_DIR);
    expect(after).toEqual(before);
  });

  it('delete by uploader removes row + unlinks + emits attachment.removed', async () => {
    const buf = Buffer.from('kill me');
    const dto = await attachmentService.upload(taskId, uploaderId, {
      originalName: `${tag}-del.txt`,
      mimeType: 'text/plain',
      sizeBytes: buf.length,
      buffer: buf,
    });
    const row = await prisma.attachment.findUniqueOrThrow({ where: { id: dto.id } });
    const abs = path.join(TMP_UPLOAD_DIR, row.storagePath);
    expect(fs.existsSync(abs)).toBe(true);

    await attachmentService.remove(dto.id, { id: uploaderId, role: 'team_member' }, 'member');
    expect(await prisma.attachment.findUnique({ where: { id: dto.id } })).toBeNull();
    expect(fs.existsSync(abs)).toBe(false);
    const acts = await prisma.activityLog.findMany({ where: { entityId: dto.id, action: 'attachment.removed' } });
    expect(acts.length).toBe(1);
  });

  it('delete by stranger member 403; by PM allowed', async () => {
    const buf = Buffer.from('block stranger');
    const dto = await attachmentService.upload(taskId, uploaderId, {
      originalName: `${tag}-perm.txt`,
      mimeType: 'text/plain',
      sizeBytes: buf.length,
      buffer: buf,
    });
    await expect(
      attachmentService.remove(dto.id, { id: strangerId, role: 'team_member' }, 'member'),
    ).rejects.toMatchObject({ statusCode: 403 });
    await attachmentService.remove(dto.id, { id: strangerId, role: 'team_member' }, 'pm');
    expect(await prisma.attachment.findUnique({ where: { id: dto.id } })).toBeNull();
  });

  it('upload rejects unsupported mime (422) and over-size (422)', async () => {
    await expect(
      attachmentService.upload(taskId, uploaderId, {
        originalName: `${tag}-bad.exe`,
        mimeType: 'application/x-msdownload',
        sizeBytes: 10,
        buffer: Buffer.from('xxxxxxxxxx'),
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      attachmentService.upload(taskId, uploaderId, {
        originalName: `${tag}-big.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 11 * 1024 * 1024,
        buffer: Buffer.alloc(0),
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
