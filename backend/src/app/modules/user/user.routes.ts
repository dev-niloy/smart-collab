import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { userController } from './user.controller';

const router = Router();

router.use(requireAuth);
router.get('/', userController.list);

export default router;
