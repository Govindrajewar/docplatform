import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/require-permission';

import { auditLogsController } from './audit-logs.controller';

export const auditLogsRouter = Router();

auditLogsRouter.use(authenticate, requirePermission('logs:read'));

auditLogsRouter.get('/', auditLogsController.list);
auditLogsRouter.get('/:id', auditLogsController.get);
