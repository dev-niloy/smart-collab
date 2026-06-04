import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { requireProjectRole } from '../../middlewares/requireProjectRole';
import { projectMemberController } from './projectMember.controller';
import {
  addMemberSchema,
  updateMemberRoleSchema,
  memberIdParamSchema,
  projectIdParamSchema,
} from './projectMember.validation';

// Mounted from project routes as `router.use('/:id/members', projectMemberRouter)`.
// `mergeParams` lets us read `:id` (projectId) from the parent.
const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get(
  '/',
  validate({ params: projectIdParamSchema }),
  requireProjectRole('member'),
  projectMemberController.list,
);

router.get(
  '/assignable',
  validate({ params: projectIdParamSchema }),
  requireProjectRole('member'),
  projectMemberController.listAssignable,
);

router.post(
  '/',
  validate({ params: projectIdParamSchema, body: addMemberSchema }),
  requireProjectRole('pm'),
  projectMemberController.add,
);

router.patch(
  '/:memberId',
  validate({ params: memberIdParamSchema, body: updateMemberRoleSchema }),
  requireProjectRole('pm'),
  projectMemberController.updateRole,
);

router.delete(
  '/:memberId',
  validate({ params: memberIdParamSchema }),
  requireProjectRole('pm'),
  projectMemberController.remove,
);

export default router;
