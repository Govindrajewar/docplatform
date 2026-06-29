import { Router } from 'express';
import {
  createTemplateSchema,
  importTemplateBundleSchema,
  previewTemplateSchema,
  saveTemplateVersionSchema,
  updateTemplateSchema,
} from '@platform/shared';

import { authenticate } from '../../middleware/authenticate';
import { recordAudit } from '../../middleware/audit';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';

import { templatesController } from './templates.controller';

export const templatesRouter = Router();

templatesRouter.use(authenticate);

templatesRouter.get('/', requirePermission('templates:read'), templatesController.list);

templatesRouter.post(
  '/import',
  requirePermission('templates:write'),
  validate(importTemplateBundleSchema),
  recordAudit('template.import', 'template'),
  templatesController.importBundle,
);

templatesRouter.post(
  '/',
  requirePermission('templates:write'),
  validate(createTemplateSchema),
  recordAudit('template.create', 'template'),
  templatesController.create,
);

templatesRouter.get('/:id', requirePermission('templates:read'), templatesController.get);
templatesRouter.patch(
  '/:id',
  requirePermission('templates:write'),
  validate(updateTemplateSchema),
  recordAudit('template.update', 'template'),
  templatesController.update,
);
templatesRouter.delete(
  '/:id',
  requirePermission('templates:delete'),
  recordAudit('template.archive', 'template'),
  templatesController.archive,
);

templatesRouter.post(
  '/:id/duplicate',
  requirePermission('templates:write'),
  recordAudit('template.duplicate', 'template'),
  templatesController.duplicate,
);
templatesRouter.post(
  '/:id/export',
  requirePermission('templates:read'),
  templatesController.exportBundle,
);
templatesRouter.post(
  '/:id/preview',
  requirePermission('templates:read'),
  validate(previewTemplateSchema),
  templatesController.preview,
);

templatesRouter.get(
  '/:id/versions',
  requirePermission('templates:version'),
  templatesController.versions.list,
);
templatesRouter.post(
  '/:id/versions',
  requirePermission('templates:version'),
  validate(saveTemplateVersionSchema),
  recordAudit('template.version.save', 'template'),
  templatesController.versions.save,
);
// Must come before "/:id/versions/:versionId" — both are 3-segment paths and Express resolves
// in registration order, so the static "compare" segment would otherwise be swallowed as :versionId.
templatesRouter.get(
  '/:id/versions/compare',
  requirePermission('templates:version'),
  templatesController.versions.compare,
);
templatesRouter.get(
  '/:id/versions/:versionId',
  requirePermission('templates:version'),
  templatesController.versions.get,
);
templatesRouter.post(
  '/:id/versions/:versionId/publish',
  requirePermission('templates:publish'),
  recordAudit('template.publish', 'template'),
  templatesController.versions.publish,
);
templatesRouter.post(
  '/:id/versions/:versionId/restore',
  requirePermission('templates:publish'),
  recordAudit('template.rollback', 'template'),
  templatesController.versions.restore,
);
