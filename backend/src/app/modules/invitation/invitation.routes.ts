import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { requireProjectRole } from '../../middlewares/requireProjectRole';
import { invitationController } from './invitation.controller';
import {
  createInvitationSchema,
  invitationIdParamSchema,
  projectIdParamSchema,
  tokenParamSchema,
} from './invitation.validation';

// Nested under /api/v1/projects/:id/invitations — list/create/revoke require
// project pm role (parity with member add/remove).
export const projectInvitationsRouter = Router({ mergeParams: true });
projectInvitationsRouter.use(requireAuth);

projectInvitationsRouter.get(
  '/',
  validate({ params: projectIdParamSchema }),
  requireProjectRole('pm'),
  invitationController.list,
);

projectInvitationsRouter.post(
  '/',
  validate({ params: projectIdParamSchema, body: createInvitationSchema }),
  requireProjectRole('pm'),
  invitationController.create,
);

projectInvitationsRouter.delete(
  '/:invitationId',
  validate({ params: invitationIdParamSchema }),
  requireProjectRole('pm'),
  invitationController.revoke,
);

// Top-level /api/v1/invitations — lookup is public (recipient may not be
// logged in yet), accept requires auth.
export const invitationRouter = Router();

invitationRouter.get(
  '/:token',
  validate({ params: tokenParamSchema }),
  invitationController.lookup,
);

invitationRouter.post(
  '/:token/accept',
  requireAuth,
  validate({ params: tokenParamSchema }),
  invitationController.accept,
);
