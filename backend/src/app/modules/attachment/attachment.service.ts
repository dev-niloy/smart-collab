import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Attachment, Role } from '@prisma/client';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import { recordActivity } from '../activityLog/activityLog.service';
import {
  UPLOAD_DIR,
  isAllowedMime,
  isWithinSizeLimit,
  safeFilename,
} from './attachment.constant';

export type AttachmentDTO = {
  id: string;
  taskId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploader: { id: string; name: string };
  createdAt: Date;
};

type WithUploader = Attachment & { uploader: { id: string; name: string } };

type SystemRole = Role;
type ProjectRoleOrAdmin = 'admin' | 'pm' | 'member';

const toDTO = (row: WithUploader): AttachmentDTO => ({
  id: row.id,
  taskId: row.taskId,
  filename: row.filename,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
  uploader: { id: row.uploader.id, name: row.uploader.name },
  createdAt: row.createdAt,
});

const ensureUploadDir = async () => {
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
};

export const resolveStoragePath = (storagePath: string): string => {
  // storagePath is relative — anchor to UPLOAD_DIR and refuse escape
  const abs = path.resolve(UPLOAD_DIR, storagePath);
  if (!abs.startsWith(path.resolve(UPLOAD_DIR))) {
    throw ApiError.badRequest('Invalid storage path', 'INVALID_STORAGE_PATH');
  }
  return abs;
};

const ensureTaskExists = async (taskId: string): Promise<{ projectId: string }> => {
  const t = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!t) throw ApiError.notFound('Task not found', 'TASK_NOT_FOUND');
  return t;
};

const findOr404 = async (id: string) => {
  const row = await prisma.attachment.findUnique({
    where: { id },
    include: { uploader: { select: { id: true, name: true } }, task: { select: { projectId: true } } },
  });
  if (!row) throw ApiError.notFound('Attachment not found', 'ATTACHMENT_NOT_FOUND');
  return row;
};

export const canDeleteAttachment = (
  uploaderId: string,
  actorId: string,
  systemRole: SystemRole,
  projectRole: ProjectRoleOrAdmin | null,
): boolean => {
  if (actorId === uploaderId) return true;
  if (systemRole === 'admin') return true;
  if (projectRole === 'admin' || projectRole === 'pm') return true;
  return false;
};

export type UploadInput = {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
};

const upload = async (
  taskId: string,
  uploaderId: string,
  input: UploadInput,
): Promise<AttachmentDTO> => {
  if (!isAllowedMime(input.mimeType)) {
    throw ApiError.unprocessable('Unsupported file type', 'UNSUPPORTED_MIME');
  }
  if (!isWithinSizeLimit(input.sizeBytes)) {
    throw ApiError.unprocessable('File too large', 'FILE_TOO_LARGE');
  }
  const { projectId } = await ensureTaskExists(taskId);
  await ensureUploadDir();

  const filename = safeFilename(input.originalName);
  const id = crypto.randomUUID();
  const storageName = `${id}-${filename}`;
  const storagePath = storageName;
  const absPath = resolveStoragePath(storagePath);

  await fsp.writeFile(absPath, input.buffer);

  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.attachment.create({
        data: {
          id,
          taskId,
          uploaderId,
          filename,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          storagePath,
        },
        include: { uploader: { select: { id: true, name: true } } },
      });
      await recordActivity(tx, {
        actorId: uploaderId,
        action: 'attachment.added',
        entityType: 'attachment',
        entityId: row.id,
        projectId,
        meta: { title: row.filename },
      });
      return toDTO(row);
    });
  } catch (err) {
    // Roll back the on-disk file if the DB insert + activity failed.
    await fsp.unlink(absPath).catch(() => {});
    throw err;
  }
};

const list = async (taskId: string): Promise<AttachmentDTO[]> => {
  await ensureTaskExists(taskId);
  const rows = await prisma.attachment.findMany({
    where: { taskId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { uploader: { select: { id: true, name: true } } },
  });
  return rows.map(toDTO);
};

const findForDownload = async (id: string): Promise<{ absPath: string; filename: string; mimeType: string }> => {
  const row = await findOr404(id);
  const absPath = resolveStoragePath(row.storagePath);
  if (!fs.existsSync(absPath)) {
    throw ApiError.notFound('Attachment file missing', 'ATTACHMENT_FILE_MISSING');
  }
  return { absPath, filename: row.filename, mimeType: row.mimeType };
};

const remove = async (
  id: string,
  actor: { id: string; role: SystemRole },
  projectRole: ProjectRoleOrAdmin | null,
): Promise<void> => {
  const existing = await findOr404(id);
  if (!canDeleteAttachment(existing.uploaderId, actor.id, actor.role, projectRole)) {
    throw ApiError.forbidden('Cannot delete this attachment', 'ATTACHMENT_FORBIDDEN');
  }
  const absPath = resolveStoragePath(existing.storagePath);
  await prisma.$transaction(async (tx) => {
    await recordActivity(tx, {
      actorId: actor.id,
      action: 'attachment.removed',
      entityType: 'attachment',
      entityId: existing.id,
      projectId: existing.task.projectId,
      meta: { title: existing.filename },
    });
    await tx.attachment.delete({ where: { id } });
  });
  // Unlink AFTER commit. If unlink fails the orphan file is logged but the
  // delete still succeeds — don't 500 the response over a leftover file.
  try {
    await fsp.unlink(absPath);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('attachment.remove: orphan file left behind', {
      attachmentId: id,
      storagePath: existing.storagePath,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

export const attachmentService = {
  upload,
  list,
  findForDownload,
  remove,
  canDeleteAttachment,
};
