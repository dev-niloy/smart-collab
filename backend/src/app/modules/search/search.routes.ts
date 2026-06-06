import { Router } from 'express';
import { validate } from '../../middlewares/validate';
import { requireAuth } from '../../middlewares/auth';
import { searchController } from './search.controller';
import { searchQuerySchema } from './search.validation';

const router = Router();

router.use(requireAuth);
router.get('/', validate({ query: searchQuerySchema }), searchController.search);

export default router;
