import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/rbac';
import { projectController } from './project.controller';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuerySchema,
  projectIdParamSchema,
} from './project.validation';
import { listTasksQuerySchema } from '../task/task.validation';
import projectMemberRouter from '../projectMember/projectMember.routes';
import { buildDashboardRouter } from '../dashboard/dashboard.routes';
import { buildProjectActivityRouter } from '../activityLog/activityLog.routes';
import { requireProjectRole } from '../../middlewares/requireProjectRole';

const router = Router();

router.use('/:id/members', projectMemberRouter);
router.use(
  '/:id/dashboard',
  requireAuth,
  requireProjectRole('member'),
  buildDashboardRouter(),
);
router.use(
  '/:id/activity',
  requireAuth,
  requireProjectRole('member'),
  buildProjectActivityRouter(),
);

router.use(requireAuth);

const mutateRoles = requireRole('admin', 'project_manager');

router.get('/', validate({ query: listProjectsQuerySchema }), projectController.list);
router.get('/:id', validate({ params: projectIdParamSchema }), projectController.getById);
router.get(
  '/:id/tasks',
  validate({ params: projectIdParamSchema, query: listTasksQuerySchema }),
  projectController.listTasks,
);
router.post('/', mutateRoles, validate({ body: createProjectSchema }), projectController.create);
router.patch(
  '/:id',
  mutateRoles,
  validate({ params: projectIdParamSchema, body: updateProjectSchema }),
  projectController.update,
);
router.delete(
  '/:id',
  mutateRoles,
  validate({ params: projectIdParamSchema }),
  projectController.remove,
);

export default router;
