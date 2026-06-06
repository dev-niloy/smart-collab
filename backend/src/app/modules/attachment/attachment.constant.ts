import path from 'node:path';

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export const FILENAME_MAX_LEN = 200;

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads');

export const isAllowedMime = (mime: string): boolean =>
  (ALLOWED_MIME_TYPES as readonly string[]).includes(mime);

export const isWithinSizeLimit = (sizeBytes: number): boolean =>
  Number.isFinite(sizeBytes) && sizeBytes > 0 && sizeBytes <= MAX_ATTACHMENT_SIZE;

// Strip path traversal, replace unsafe chars, and cap length while preserving
// the file extension when possible.
export const safeFilename = (raw: string): string => {
  const trimmed = (raw || '').trim();
  const base = path.basename(trimmed.replace(/\\/g, '/'));
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^[._]+/, '');
  const safe = cleaned.length > 0 ? cleaned : 'file';
  if (safe.length <= FILENAME_MAX_LEN) return safe;
  const ext = path.extname(safe).slice(0, 16);
  const stem = safe.slice(0, FILENAME_MAX_LEN - ext.length);
  return `${stem}${ext}`;
};
