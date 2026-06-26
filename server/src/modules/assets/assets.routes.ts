import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { recordAudit } from '../../middleware/audit';
import { rateLimit } from '../../middleware/rate-limit';
import { requirePermission } from '../../middleware/require-permission';

import { assetsController, uploadMiddleware } from './assets.controller';

export const assetsRouter = Router();

assetsRouter.use(authenticate);

const uploadRateLimit = rateLimit({
  windowSeconds: 60,
  max: 20,
  keyPrefix: 'asset-upload',
  keyFn: (req) => req.user?.userId ?? req.ip ?? 'unknown',
});

assetsRouter.get('/', requirePermission('assets:read'), assetsController.list);
assetsRouter.get('/:id', requirePermission('assets:read'), assetsController.get);
assetsRouter.get('/:id/file', requirePermission('assets:read'), assetsController.getFile);
assetsRouter.post(
  '/',
  requirePermission('assets:write'),
  uploadRateLimit,
  uploadMiddleware,
  recordAudit('asset.upload', 'asset'),
  assetsController.upload,
);
assetsRouter.delete(
  '/:id',
  requirePermission('assets:delete'),
  recordAudit('asset.delete', 'asset'),
  assetsController.remove,
);
