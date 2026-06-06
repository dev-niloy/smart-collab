import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { notificationController } from './notification.controller';
import { sseHandler } from './notification.sse';
import { listNotificationsQuerySchema, notificationIdParamSchema } from './notification.validation';

const router = Router();

router.use(requireAuth);

router.get('/', validate({ query: listNotificationsQuerySchema }), notificationController.list);
router.get('/unread-count', notificationController.unreadCount);
// SSE channel — long-lived response. Mounted before mutating endpoints so
// `validate` middlewares on /:id routes never intercept.
router.get('/stream', sseHandler());
router.post('/:id/read', validate({ params: notificationIdParamSchema }), notificationController.markRead);
router.post('/read-all', notificationController.markAllRead);

export default router;
