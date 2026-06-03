import { Router, type RequestHandler } from 'express';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { ApiError } from '../../errors/ApiError';
import { authController } from './auth.controller';
import { signupSchema, loginSchema, demoLoginSchema } from './auth.validation';

const router = Router();

const demoLoginGate: RequestHandler = (_req, _res, next) => {
  if (process.env.ENABLE_DEMO_LOGIN === 'false') {
    return next(ApiError.notFound('Demo login is disabled', 'DEMO_DISABLED'));
  }
  return next();
};

router.post('/signup', validate({ body: signupSchema }), authController.signup);
router.post('/login', validate({ body: loginSchema }), authController.login);
router.post(
  '/demo-login',
  demoLoginGate,
  validate({ body: demoLoginSchema }),
  authController.demoLogin,
);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', requireAuth, authController.me);

export default router;
