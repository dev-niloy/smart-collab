import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { activityLogController } from './activityLog.controller';
import { listQuerySchema } from './activityLog.validation';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  validate({ query: listQuerySchema }),
  activityLogController.listGlobal,
);

export default router;

// Reusable router for nesting under projects.
export const buildProjectActivityRouter = (): Router => {
  const r = Router({ mergeParams: true });
  r.use(requireAuth);
  r.get('/', validate({ query: listQuerySchema }), activityLogController.listByProject);
  return r;
};
