import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { requireTaskAccess } from '../comment/requireTaskAccess';
import { attachmentController } from './attachment.controller';
import { attachmentUploader, handleMulterError } from './multer';

// Mounted under /api/v1/tasks/:taskId/attachments
const router = Router({ mergeParams: true });

router.use(requireAuth);
router.use(requireTaskAccess);

router.get('/', attachmentController.list);
router.post('/', attachmentUploader.single('file'), handleMulterError, attachmentController.upload);
router.delete('/:id', attachmentController.remove);

export default router;

// Top-level download route mounted at /api/v1/attachments
export const attachmentDownloadRouter = (() => {
  const r = Router();
  r.use(requireAuth);
  r.get('/file/:id', attachmentController.download);
  return r;
})();
