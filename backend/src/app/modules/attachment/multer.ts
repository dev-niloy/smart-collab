import multer from 'multer';
import type { ErrorRequestHandler } from 'express';
import { MAX_ATTACHMENT_SIZE, isAllowedMime } from './attachment.constant';
import { ApiError } from '../../errors/ApiError';

export const attachmentUploader = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedMime(file.mimetype)) {
      cb(new ApiError(422, 'Unsupported file type', 'UNSUPPORTED_MIME'));
      return;
    }
    cb(null, true);
  },
});

// Catch multer errors at the route boundary and turn them into 422.
export const handleMulterError: ErrorRequestHandler = (err, _req, _res, next) => {
  if (err && (err as { name?: string }).name === 'MulterError') {
    const code = (err as { code?: string }).code;
    if (code === 'LIMIT_FILE_SIZE') {
      return next(ApiError.unprocessable('File too large', 'FILE_TOO_LARGE'));
    }
    return next(ApiError.unprocessable('Upload failed', 'UPLOAD_FAILED'));
  }
  return next(err);
};
