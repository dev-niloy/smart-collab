import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import projectRoutes from '../modules/project/project.routes';
import taskRoutes from '../modules/task/task.routes';

const router = Router();

router.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/projects', projectRoutes);
router.use('/api/v1/tasks', taskRoutes);

export default router;
