import { Router } from 'express';
import { requireAuth } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { requireTaskAccess } from './requireTaskAccess';
import { commentController } from './comment.controller';
import {
  createCommentBodySchema,
  updateCommentBodySchema,
  listCommentsQuerySchema,
} from './comment.validation';

const router = Router({ mergeParams: true });

router.use(requireAuth);
router.use(requireTaskAccess);

router.get('/', validate({ query: listCommentsQuerySchema }), commentController.list);
router.post('/', validate({ body: createCommentBodySchema }), commentController.create);
router.patch('/:id', validate({ body: updateCommentBodySchema }), commentController.update);
router.delete('/:id', commentController.remove);

export default router;
