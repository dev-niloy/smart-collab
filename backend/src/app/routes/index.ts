import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';

const router = Router();

router.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

router.use('/api/v1/auth', authRoutes);

export default router;
