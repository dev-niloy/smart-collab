import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import projectRoutes from '../modules/project/project.routes';
import taskRoutes from '../modules/task/task.routes';
import userRoutes from '../modules/user/user.routes';
import dashboardRoutes from '../modules/dashboard/dashboard.routes';
import activityLogRoutes from '../modules/activityLog/activityLog.routes';
import searchRoutes from '../modules/search/search.routes';
import { attachmentDownloadRouter } from '../modules/attachment/attachment.routes';

const router = Router();

router.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/projects', projectRoutes);
router.use('/api/v1/tasks', taskRoutes);
router.use('/api/v1/users', userRoutes);
router.use('/api/v1/dashboard', dashboardRoutes);
router.use('/api/v1/activity', activityLogRoutes);
router.use('/api/v1/search', searchRoutes);
router.use('/api/v1/attachments', attachmentDownloadRouter);

export default router;
