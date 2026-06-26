import { Router } from 'express';
import { updateOrganizationSchema } from '@platform/shared';

import { authenticate } from '../../middleware/authenticate';
import { recordAudit } from '../../middleware/audit';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';

import { organizationsController } from './organizations.controller';

export const organizationsRouter = Router();

organizationsRouter.use(authenticate);

// v1 scope: every authenticated user belongs to exactly one organization (their own) — see PRD 03 §3.3.
organizationsRouter.get(
  '/mine',
  requirePermission('organizations:read'),
  organizationsController.getMine,
);
organizationsRouter.patch(
  '/mine',
  requirePermission('organizations:write'),
  validate(updateOrganizationSchema),
  recordAudit('organization.update', 'organization'),
  organizationsController.updateMine,
);
