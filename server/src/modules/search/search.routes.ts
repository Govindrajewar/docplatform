import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate';

import { searchController } from './search.controller';

export const searchRouter = Router();

searchRouter.get('/', authenticate, searchController.search);
