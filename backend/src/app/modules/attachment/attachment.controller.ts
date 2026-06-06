import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { attachmentService } from './attachment.service';

export const attachmentController = {
  upload: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const file = (req as Request & { file?: Express.Multer.File }).file;
      if (!file) throw ApiError.unprocessable('Missing file field', 'MISSING_FILE');
      const dto = await attachmentService.upload(req.params.taskId, req.user.id, {
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        buffer: file.buffer,
      });
      res.status(201).json({ attachment: dto });
    } catch (err) {
      next(err);
    }
  },

  list: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const items = await attachmentService.list(req.params.taskId);
      res.status(200).json({ items });
    } catch (err) {
      next(err);
    }
  },

  remove: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const projectRole = req.projectRole ?? null;
      await attachmentService.remove(req.params.id, { id: req.user.id, role: req.user.role }, projectRole);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  download: async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) throw ApiError.unauthorized('Not authenticated', 'NOT_AUTHENTICATED');
      const { absPath, filename, mimeType } = await attachmentService.findForDownload(req.params.id);
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.sendFile(absPath);
    } catch (err) {
      next(err);
    }
  },
};
