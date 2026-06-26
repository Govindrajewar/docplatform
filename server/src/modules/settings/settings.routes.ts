import { Router } from 'express';
import { updateSettingsSchema } from '@platform/shared';

import { authenticate } from '../../middleware/authenticate';
import { recordAudit } from '../../middleware/audit';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';

import { settingsController } from './settings.controller';

export const settingsRouter = Router();

settingsRouter.use(authenticate);

settingsRouter.get('/', requirePermission('settings:read'), settingsController.get);
settingsRouter.patch(
  '/',
  requirePermission('settings:write'),
  validate(updateSettingsSchema),
  recordAudit('settings.update', 'organization'),
  settingsController.update,
);
