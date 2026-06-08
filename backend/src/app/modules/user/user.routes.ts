import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { userController } from './user.controller';
import { changePasswordSchema, updateProfileSchema } from './user.validation';
import { avatarUploader, handleAvatarMulterError } from './user.multer';

const router = Router();

router.use(requireAuth);

// Profile self-service
router.get('/me', userController.me);
router.patch('/me', validate({ body: updateProfileSchema }), userController.updateMe);
router.patch(
  '/me/password',
  validate({ body: changePasswordSchema }),
  userController.changePassword,
);
router.post(
  '/me/avatar',
  avatarUploader.single('file'),
  handleAvatarMulterError,
  userController.uploadAvatar,
);
router.delete('/me/avatar', userController.removeAvatar);
router.get('/me/avatar', userController.getAvatar);

// Typeahead search for the "add member" / "invite" UX. Any authed user can
// hit it, but the result set is intentionally minimal (id, email, name,
// avatarUrl) so it's safe even outside admin/PM contexts.
router.get('/search', userController.search);

// Existing admin-style listing (kept intact)
router.get('/', userController.list);

export default router;
