import { Router } from 'express';
import { createDocumentSchema } from '@platform/shared';

import { authenticate } from '../../middleware/authenticate';
import { recordAudit } from '../../middleware/audit';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';

import { documentsController } from './documents.controller';

export const documentsRouter = Router();

documentsRouter.use(authenticate);

// Data import / bulk-generate (PRD 05 §5.8: /documents/import, /documents/bulk-generate,
// /documents/batches/:batchId) are a separate, larger increment — deferred, see PRD 11 Phase 5.

documentsRouter.get('/', requirePermission('documents:read'), documentsController.list);
documentsRouter.post(
  '/',
  requirePermission('documents:generate'),
  validate(createDocumentSchema),
  recordAudit('document.generate', 'document'),
  documentsController.create,
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
