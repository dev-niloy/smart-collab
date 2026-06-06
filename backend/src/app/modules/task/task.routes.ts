import { Router, type RequestHandler } from 'express';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { ApiError } from '../../errors/ApiError';
import { taskController } from './task.controller';
import commentRoutes from '../comment/comment.routes';
import attachmentRoutes from '../attachment/attachment.routes';
import {
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
  taskIdParamSchema,
  taskAssigneeAddSchema,
  taskAssigneeRemoveParamsSchema,
  taskAssigneesReplaceSchema,
  hasAssigneeKeys,
  USE_ASSIGNEE_ENDPOINTS_MESSAGE,
} from './task.validation';

// Pre-validation guard: PATCH /tasks/:id rejects assignee body keys before zod
// runs (zod would silently strip them and then trip the at-least-one-field refine,
// producing a generic VALIDATION_ERROR instead of the specific code).
const rejectAssigneeKeysOnUpdate: RequestHandler = (req, _res, next) => {
  if (hasAssigneeKeys(req.body)) {
    return next(
      ApiError.unprocessable(USE_ASSIGNEE_ENDPOINTS_MESSAGE, 'USE_ASSIGNEE_ENDPOINTS'),
    );
  }
  next();
};

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
  rejectAssigneeKeysOnUpdate,
  validate({ body: updateTaskSchema }),
  taskController.update,
);
router.delete('/:id', validate({ params: taskIdParamSchema }), taskController.remove);
router.post(
  '/:id/restore',
  validate({ params: taskIdParamSchema }),
  taskController.restore,
);

// Phase C — multi-assignee management (PM/admin only; enforced in service layer)
router.post(
  '/:id/assignees',
  validate({ params: taskIdParamSchema }),
  validate({ body: taskAssigneeAddSchema }),
  taskController.addAssignee,
);
router.put(
  '/:id/assignees',
  validate({ params: taskIdParamSchema }),
  validate({ body: taskAssigneesReplaceSchema }),
  taskController.replaceAssignees,
);
router.delete(
  '/:id/assignees/:userId',
  validate({ params: taskAssigneeRemoveParamsSchema }),
  taskController.removeAssignee,
);

export default router;
