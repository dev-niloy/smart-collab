import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { taskController } from './task.controller';
import { requireTaskOwnerOrPrivileged } from './task.ownership';
import {
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
  taskIdParamSchema,
} from './task.validation';

const router = Router();

router.use(requireAuth);

router.get('/', validate({ query: listTasksQuerySchema }), taskController.list);
router.get('/:id', validate({ params: taskIdParamSchema }), taskController.getById);
router.post('/', validate({ body: createTaskSchema }), taskController.create);
router.patch(
  '/:id',
  validate({ params: taskIdParamSchema }),
  requireTaskOwnerOrPrivileged,
  validate({ body: updateTaskSchema }),
  taskController.update,
);
router.delete(
  '/:id',
  requireRole('admin', 'project_manager'),
  validate({ params: taskIdParamSchema }),
  taskController.remove,
);

export default router;
