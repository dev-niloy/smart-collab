import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { requireTaskAccess } from '../../middlewares/requireTaskAccess';
import { attachmentController } from './attachment.controller';
import { attachmentUploader, handleMulterError } from './multer';
import {
  taskScopedParamsSchema,
  attachmentIdParamSchema,
  attachmentDownloadParamSchema,
} from './attachment.validation';

// Mounted under /api/v1/tasks/:taskId/attachments
const router = Router({ mergeParams: true });

router.use(requireAuth);
router.use(validate({ params: taskScopedParamsSchema }));
router.use(requireTaskAccess);

router.get('/', attachmentController.list);
router.post('/', attachmentUploader.single('file'), handleMulterError, attachmentController.upload);
router.delete('/:id', validate({ params: attachmentIdParamSchema }), attachmentController.remove);

export default router;

// Top-level download route mounted at /api/v1/attachments
export const attachmentDownloadRouter = (() => {
  const r = Router();
  r.use(requireAuth);
  r.get(
    '/file/:id',
    validate({ params: attachmentDownloadParamSchema }),
    attachmentController.download,
  );
  return r;
})();
