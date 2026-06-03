import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { authController } from './auth.controller';
import { signupSchema, loginSchema, demoLoginSchema } from './auth.validation';

const router = Router();

router.post('/signup', validate({ body: signupSchema }), authController.signup);
router.post('/login', validate({ body: loginSchema }), authController.login);
router.post('/demo-login', validate({ body: demoLoginSchema }), authController.demoLogin);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

export default router;
