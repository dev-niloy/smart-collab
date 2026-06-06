import path from 'node:path';

export const AVATAR_MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export const AVATAR_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export type AvatarMimeType = (typeof AVATAR_ALLOWED_MIME_TYPES)[number];

export const isAllowedAvatarMime = (mime: string): boolean =>
  (AVATAR_ALLOWED_MIME_TYPES as readonly string[]).includes(mime);

export const AVATAR_UPLOAD_SUBDIR = 'avatars';

export const AVATAR_UPLOAD_DIR =
  process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR, AVATAR_UPLOAD_SUBDIR)
    : path.resolve(process.cwd(), 'uploads', AVATAR_UPLOAD_SUBDIR);

// Minimum new-password length (mirror of auth signup validation).
export const PASSWORD_MIN_LENGTH = 8;

export const NAME_MIN_LENGTH = 1;
export const NAME_MAX_LENGTH = 200;

// Error codes
export const ERR_EMAIL_TAKEN = 'EMAIL_TAKEN';
export const ERR_INVALID_CURRENT_PASSWORD = 'INVALID_CURRENT_PASSWORD';
export const ERR_NO_AVATAR = 'NO_AVATAR';
export const ERR_AVATAR_TOO_LARGE = 'AVATAR_TOO_LARGE';
export const ERR_UNSUPPORTED_AVATAR_MIME = 'UNSUPPORTED_AVATAR_MIME';
export const ERR_USER_NOT_FOUND = 'USER_NOT_FOUND';

export const EMAIL_TAKEN_MESSAGE = 'Email is already in use.';
export const INVALID_CURRENT_PASSWORD_MESSAGE = 'Current password is incorrect.';
export const NO_AVATAR_MESSAGE = 'No avatar to download.';
