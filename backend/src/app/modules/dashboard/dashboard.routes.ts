import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { dashboardController } from './dashboard.controller';
import {
  productivityQuerySchema,
  upcomingQuerySchema,
} from './dashboard.validation';

// Reusable child router — mounted globally at /api/v1/dashboard AND
// nested under /api/v1/projects/:id/dashboard (mergeParams picks up :id).
export const buildDashboardRouter = (): Router => {
  const router = Router({ mergeParams: true });
  router.use(requireAuth);

  router.get('/kpis', dashboardController.kpis);
  router.get('/status', dashboardController.status);
  router.get('/priority', dashboardController.priority);
  router.get(
    '/productivity',
    validate({ query: productivityQuerySchema }),
    dashboardController.productivity,
  );
  router.get(
    '/upcoming',
    validate({ query: upcomingQuerySchema }),
    dashboardController.upcoming,
  );
  router.get('/high-priority', dashboardController.highPriority);

  return router;
};

export default buildDashboardRouter();
