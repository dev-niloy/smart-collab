import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { taskController } from './task.controller';
import commentRoutes from '../comment/comment.routes';
import attachmentRoutes from '../attachment/attachment.routes';
import {
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
  taskIdParamSchema,
} from './task.validation';

const router = Router();

router.use(requireAuth);

router.use('/:taskId/comments', commentRoutes);
router.use('/:taskId/attachments', attachmentRoutes);

router.get('/', validate({ query: listTasksQuerySchema }), taskController.list);
router.get('/:id', validate({ params: taskIdParamSchema }), taskController.getById);
router.post('/', validate({ body: createTaskSchema }), taskController.create);
// PATCH + DELETE + restore: service layer enforces all write/delete RBAC (canWriteTask, canDeleteTask, canSeeDeleted).
router.patch(
  '/:id',
  validate({ params: taskIdParamSchema }),
  validate({ body: updateTaskSchema }),
  taskController.update,
);
router.delete('/:id', validate({ params: taskIdParamSchema }), taskController.remove);
router.post(
  '/:id/restore',
  validate({ params: taskIdParamSchema }),
  taskController.restore,
);

export default router;
