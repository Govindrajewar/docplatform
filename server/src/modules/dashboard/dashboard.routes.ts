import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate';

import { dashboardController } from './dashboard.controller';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get('/summary', dashboardController.summary);
