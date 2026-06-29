import { Router } from 'express';
import { createFieldDefinitionSchema, updateFieldDefinitionSchema } from '@platform/shared';

import { authenticate } from '../../middleware/authenticate';
import { recordAudit } from '../../middleware/audit';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';

import { fieldDefinitionsController } from './field-definitions.controller';

export const fieldDefinitionsRouter = Router();

fieldDefinitionsRouter.use(authenticate);

// Field definitions are a sub-concern of templates (PRD 05 places §5.7 directly under §5.6) and
// have no dedicated resource in the RBAC matrix (PRD 07 §7.1) — reusing templates:read/write.
fieldDefinitionsRouter.get(
  '/',
  requirePermission('templates:read'),
  fieldDefinitionsController.list,
);
fieldDefinitionsRouter.post(
  '/',
  requirePermission('templates:write'),
  validate(createFieldDefinitionSchema),
  recordAudit('field-definition.create', 'field-definition'),
  fieldDefinitionsController.create,
);
fieldDefinitionsRouter.patch(
  '/:id',
  requirePermission('templates:write'),
  validate(updateFieldDefinitionSchema),
  recordAudit('field-definition.update', 'field-definition'),
  fieldDefinitionsController.update,
);
fieldDefinitionsRouter.delete(
  '/:id',
  requirePermission('templates:write'),
  recordAudit('field-definition.delete', 'field-definition'),
  fieldDefinitionsController.remove,
);
