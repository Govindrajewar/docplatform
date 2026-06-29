import { Router } from 'express';
import { bulkGenerateSchema, createDocumentSchema } from '@platform/shared';

import { authenticate } from '../../middleware/authenticate';
import { recordAudit } from '../../middleware/audit';
import { rateLimit } from '../../middleware/rate-limit';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';

import { documentsController, importUploadMiddleware } from './documents.controller';

export const documentsRouter = Router();

documentsRouter.use(authenticate);

const bulkGenerateRateLimit = rateLimit({
  windowSeconds: 60,
  max: 5,
  keyPrefix: 'documents-bulk-generate',
  keyFn: (req) => req.user?.userId ?? req.ip ?? 'unknown',
});

documentsRouter.get('/', requirePermission('documents:read'), documentsController.list);
documentsRouter.post(
  '/',
  requirePermission('documents:generate'),
  validate(createDocumentSchema),
  recordAudit('document.generate', 'document'),
  documentsController.create,
);

// Data import / bulk-generate (PRD 05 §5.8).
documentsRouter.post(
  '/import',
  requirePermission('documents:generate'),
  importUploadMiddleware,
  documentsController.importPreview,
);
documentsRouter.post(
  '/bulk-generate',
  requirePermission('documents:generate'),
  bulkGenerateRateLimit,
  validate(bulkGenerateSchema),
  recordAudit('document.bulk-generate', 'document'),
  documentsController.bulkGenerate,
);
documentsRouter.get(
  '/batches/:batchId',
  requirePermission('documents:read'),
  documentsController.getBatch,
);

documentsRouter.get('/:id', requirePermission('documents:read'), documentsController.get);
documentsRouter.get(
  '/:id/pdf',
  requirePermission('documents:download'),
  documentsController.getPdf,
);
documentsRouter.post(
  '/:id/regenerate',
  requirePermission('documents:generate'),
  recordAudit('document.regenerate', 'document'),
  documentsController.regenerate,
);
documentsRouter.delete(
  '/:id',
  requirePermission('documents:delete'),
  recordAudit('document.delete', 'document'),
  documentsController.remove,
);
