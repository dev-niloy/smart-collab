import multer from 'multer';
import type { ErrorRequestHandler } from 'express';
import { AVATAR_MAX_SIZE, ERR_UNSUPPORTED_AVATAR_MIME, isAllowedAvatarMime } from './user.constant';
import { ApiError } from '../../errors/ApiError';

export const avatarUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedAvatarMime(file.mimetype)) {
      cb(new ApiError(422, 'Unsupported avatar image type', ERR_UNSUPPORTED_AVATAR_MIME));
      return;
    }
    cb(null, true);
  },
});

export const handleAvatarMulterError: ErrorRequestHandler = (err, _req, _res, next) => {
  if (err && (err as { name?: string }).name === 'MulterError') {
    const code = (err as { code?: string }).code;
    if (code === 'LIMIT_FILE_SIZE') {
      return next(ApiError.unprocessable('Avatar file is too large (max 2 MB).', 'AVATAR_TOO_LARGE'));
    }
    return next(ApiError.unprocessable('Avatar upload failed', 'AVATAR_UPLOAD_FAILED'));
  }
  return next(err);
};
