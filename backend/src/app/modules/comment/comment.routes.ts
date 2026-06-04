import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { requireTaskAccess } from '../../middlewares/requireTaskAccess';
import { commentController } from './comment.controller';
import {
  createCommentBodySchema,
  updateCommentBodySchema,
  listCommentsQuerySchema,
  taskScopedParamsSchema,
  commentIdParamSchema,
} from './comment.validation';

const router = Router({ mergeParams: true });

router.use(requireAuth);
// Validate :taskId before requireTaskAccess so malformed ids return 400 not 500.
router.use(validate({ params: taskScopedParamsSchema }));
router.use(requireTaskAccess);

router.get('/', validate({ query: listCommentsQuerySchema }), commentController.list);
router.post('/', validate({ body: createCommentBodySchema }), commentController.create);
router.patch(
  '/:id',
  validate({ params: commentIdParamSchema, body: updateCommentBodySchema }),
  commentController.update,
);
router.delete('/:id', validate({ params: commentIdParamSchema }), commentController.remove);

export default router;
