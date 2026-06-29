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
/**
 * @openapi
 * /field-definitions:
 *   get:
 *     tags: [Field Definitions]
 *     summary: List available fields (hardcoded system fields + org custom fields)
 *     responses:
 *       '200':
 *         description: All fields available to templates in this organization
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key: { type: string, example: customer.name }
 *                       label: { type: string, example: Customer Name }
 *                       type: { type: string, enum: [text, date, currency, number, boolean] }
 *                       system: { type: boolean }
 *                       required: { type: boolean }
 *                       defaultValue: { nullable: true }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
fieldDefinitionsRouter.get(
  '/',
  requirePermission('templates:read'),
  fieldDefinitionsController.list,
);

/**
 * @openapi
 * /field-definitions:
 *   post:
 *     tags: [Field Definitions]
 *     summary: Create a custom field
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, label]
 *             properties:
 *               key: { type: string, example: custom.poNumber, description: 'Must match "custom.someName"' }
 *               label: { type: string, example: PO Number }
 *               type: { type: string, enum: [text, date, currency, number, boolean], default: text }
 *               required: { type: boolean, default: false }
 *               defaultValue: { nullable: true }
 *               validation: { type: object, properties: { pattern: { type: string } } }
 *     responses:
 *       '201':
 *         description: Field created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '422':
 *         $ref: '#/components/responses/ValidationError'
 */
fieldDefinitionsRouter.post(
  '/',
  requirePermission('templates:write'),
  validate(createFieldDefinitionSchema),
  recordAudit('field-definition.create', 'field-definition'),
  fieldDefinitionsController.create,
);

/**
 * @openapi
 * /field-definitions/{id}:
 *   patch:
 *     tags: [Field Definitions]
 *     summary: Update a custom field
 *     description: '`key` and `type` cannot change once set, since both are baked into any template that already references this field.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string }
 *               required: { type: boolean }
 *               defaultValue: { nullable: true }
 *               validation: { type: object, properties: { pattern: { type: string } } }
 *     responses:
 *       '200':
 *         description: Updated field
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '422':
 *         $ref: '#/components/responses/ValidationError'
 */
fieldDefinitionsRouter.patch(
  '/:id',
  requirePermission('templates:write'),
  validate(updateFieldDefinitionSchema),
  recordAudit('field-definition.update', 'field-definition'),
  fieldDefinitionsController.update,
);

/**
 * @openapi
 * /field-definitions/{id}:
 *   delete:
 *     tags: [Field Definitions]
 *     summary: Delete a custom field
 *     description: Rejected if any published template version still references this field's key.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Field deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { message: { type: string } } }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         description: Still referenced by a published template version
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
fieldDefinitionsRouter.delete(
  '/:id',
  requirePermission('templates:write'),
  recordAudit('field-definition.delete', 'field-definition'),
  fieldDefinitionsController.remove,
);
