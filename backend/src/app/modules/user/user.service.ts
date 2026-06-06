import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../../../config/prisma';
import { ApiError } from '../../errors/ApiError';
import { BCRYPT_ROUNDS } from '../auth/auth.constant';
import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_UPLOAD_DIR,
  EMAIL_TAKEN_MESSAGE,
  ERR_EMAIL_TAKEN,
  ERR_INVALID_CURRENT_PASSWORD,
  ERR_NO_AVATAR,
  ERR_USER_NOT_FOUND,
  INVALID_CURRENT_PASSWORD_MESSAGE,
  NO_AVATAR_MESSAGE,
} from './user.constant';
import type { ChangePasswordInput, UpdateProfileInput } from './user.validation';

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const AVATAR_URL = '/api/v1/users/me/avatar';

const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'P2002';

const toPublicUser = (row: {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarPath: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  avatarUrl: row.avatarPath ? AVATAR_URL : null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const findUserOr404 = async (userId: string) => {
  const row = await prisma.user.findUnique({ where: { id: userId } });
  if (!row) throw ApiError.notFound('User not found', ERR_USER_NOT_FOUND);
  return row;
};

// List endpoint keeps its narrow legacy DTO (no timestamps, no
// passwordHash) so the assignee-picker contract from earlier subgoals
// stays stable. We tack on `avatarUrl` so admin views can render the pic.
const list = async (): Promise<
  Array<{ id: string; email: string; name: string; role: string; avatarUrl: string | null }>
> => {
  const rows = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, avatarPath: true },
    orderBy: { name: 'asc' },
  });
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    avatarUrl: r.avatarPath ? AVATAR_URL : null,
  }));
};

const getMe = async (userId: string): Promise<PublicUser> => {
  return toPublicUser(await findUserOr404(userId));
};

const updateMe = async (userId: string, input: UpdateProfileInput): Promise<PublicUser> => {
  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
      },
    });
    return toPublicUser(updated);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw ApiError.unprocessable(EMAIL_TAKEN_MESSAGE, ERR_EMAIL_TAKEN);
    }
    throw err;
  }
};

const changePassword = async (
  userId: string,
  currentSessionId: string | null,
  input: ChangePasswordInput,
): Promise<void> => {
  const user = await findUserOr404(userId);
  const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!ok) {
    throw ApiError.unprocessable(INVALID_CURRENT_PASSWORD_MESSAGE, ERR_INVALID_CURRENT_PASSWORD);
  }
  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    // Drop every other session row for this user so other tabs / devices
    // are forced back to /login. The caller's own session row is spared
    // so they stay logged in here.
    await tx.session.deleteMany({
      where: {
        userId,
        ...(currentSessionId ? { NOT: { id: currentSessionId } } : {}),
      },
    });
  });
};

const ensureAvatarDir = async () => {
  await fs.mkdir(AVATAR_UPLOAD_DIR, { recursive: true });
};

const resolveAvatarPath = (relative: string): string => {
  const abs = path.resolve(AVATAR_UPLOAD_DIR, relative);
  if (!abs.startsWith(path.resolve(AVATAR_UPLOAD_DIR))) {
    throw ApiError.badRequest('Invalid avatar storage path', 'INVALID_STORAGE_PATH');
  }
  return abs;
};

const extForMime = (mime: string): string => {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'bin';
};

type UploadedAvatar = { buffer: Buffer; mimeType: string };

const uploadAvatar = async (userId: string, file: UploadedAvatar): Promise<PublicUser> => {
  if (!(AVATAR_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimeType)) {
    throw ApiError.unprocessable('Unsupported avatar image type', 'UNSUPPORTED_AVATAR_MIME');
  }
  await ensureAvatarDir();
  const ext = extForMime(file.mimeType);
  const relative = `${userId}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const abs = resolveAvatarPath(relative);
  await fs.writeFile(abs, file.buffer);

  // Best-effort delete the previous avatar file (no error if missing).
  const prior = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarPath: true },
  });
  if (prior?.avatarPath && prior.avatarPath !== relative) {
    await fs.unlink(resolveAvatarPath(prior.avatarPath)).catch(() => undefined);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { avatarPath: relative },
  });
  return toPublicUser(updated);
};

const removeAvatar = async (userId: string): Promise<PublicUser> => {
  const user = await findUserOr404(userId);
  if (user.avatarPath) {
    await fs.unlink(resolveAvatarPath(user.avatarPath)).catch(() => undefined);
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { avatarPath: null },
  });
  return toPublicUser(updated);
};

const getAvatarFile = async (
  userId: string,
): Promise<{ buffer: Buffer; mimeType: string; filename: string }> => {
  const user = await findUserOr404(userId);
  if (!user.avatarPath) {
    throw ApiError.notFound(NO_AVATAR_MESSAGE, ERR_NO_AVATAR);
  }
  const abs = resolveAvatarPath(user.avatarPath);
  const buffer = await fs.readFile(abs);
  const ext = path.extname(user.avatarPath).slice(1).toLowerCase();
  const mimeType =
    ext === 'png'
      ? 'image/png'
      : ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'webp'
          ? 'image/webp'
          : ext === 'gif'
            ? 'image/gif'
            : 'application/octet-stream';
  return { buffer, mimeType, filename: user.avatarPath };
};

export const userService = {
  list,
  getMe,
  updateMe,
  changePassword,
  uploadAvatar,
  removeAvatar,
  getAvatarFile,
  // exposed for tests
  _toPublicUser: toPublicUser,
  _resolveAvatarPath: resolveAvatarPath,
};
