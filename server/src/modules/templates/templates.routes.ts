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

/**
 * @openapi
 * /templates:
 *   get:
 *     tags: [Templates]
 *     summary: List templates
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: documentType
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, published, archived] }
 *     responses:
 *       '200':
 *         description: Paginated list of templates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { type: object } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
templatesRouter.get('/', requirePermission('templates:read'), templatesController.list);

/**
 * @openapi
 * /templates/import:
 *   post:
 *     tags: [Templates]
 *     summary: Import a portable template bundle (as exported by `/templates/{id}/export`)
 *     description: Creates a brand-new template (and an initial draft version) from the bundle — does not merge into an existing template.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, documentType, layoutJson]
 *             properties:
 *               name: { type: string }
 *               documentType: { type: string }
 *               layoutJson:
 *                 type: object
 *                 description: 'Full template layout JSON — see docs/PRD/04-template-json-schema.md'
 *     responses:
 *       '201':
 *         description: Template imported
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
templatesRouter.post(
  '/import',
  requirePermission('templates:write'),
  validate(importTemplateBundleSchema),
  recordAudit('template.import', 'template'),
  templatesController.importBundle,
);

/**
 * @openapi
 * /templates:
 *   post:
 *     tags: [Templates]
 *     summary: Create a template
 *     description: Creates an empty initial draft version (`version 1`) alongside the template record.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, documentType]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 200, example: Tax Invoice }
 *               documentType: { type: string, example: invoice, description: 'Free-form — not a fixed enum' }
 *               tags: { type: array, items: { type: string }, default: [] }
 *     responses:
 *       '201':
 *         description: Template created
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
templatesRouter.post(
  '/',
  requirePermission('templates:write'),
  validate(createTemplateSchema),
  recordAudit('template.create', 'template'),
  templatesController.create,
);

/**
 * @openapi
 * /templates/{id}:
 *   get:
 *     tags: [Templates]
 *     summary: Get a template, including its latest version
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: The template and its latest version
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
 */
templatesRouter.get('/:id', requirePermission('templates:read'), templatesController.get);

/**
 * @openapi
 * /templates/{id}:
 *   patch:
 *     tags: [Templates]
 *     summary: Update template metadata (name, documentType, tags)
 *     description: Does not touch layout — use `POST /templates/{id}/versions` to change the layout.
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
 *               name: { type: string }
 *               documentType: { type: string }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       '200':
 *         description: Updated template
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
templatesRouter.patch(
  '/:id',
  requirePermission('templates:write'),
  validate(updateTemplateSchema),
  recordAudit('template.update', 'template'),
  templatesController.update,
);

/**
 * @openapi
 * /templates/{id}:
 *   delete:
 *     tags: [Templates]
 *     summary: Archive a template (sets status to "archived")
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Template archived
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
 */
templatesRouter.delete(
  '/:id',
  requirePermission('templates:delete'),
  recordAudit('template.archive', 'template'),
  templatesController.archive,
);

/**
 * @openapi
 * /templates/{id}/duplicate:
 *   post:
 *     tags: [Templates]
 *     summary: Duplicate a template, including its latest version
 *     description: Creates an entirely independent copy in draft status — later edits to either template never affect the other.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '201':
 *         description: The new, independent template copy
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
 */
templatesRouter.post(
  '/:id/duplicate',
  requirePermission('templates:write'),
  recordAudit('template.duplicate', 'template'),
  templatesController.duplicate,
);

/**
 * @openapi
 * /templates/{id}/export:
 *   post:
 *     tags: [Templates]
 *     summary: Export a portable template bundle (for `/templates/import` into another org)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: The exportable bundle
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     documentType: { type: string }
 *                     layoutJson: { type: object }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
templatesRouter.post(
  '/:id/export',
  requirePermission('templates:read'),
  templatesController.exportBundle,
);

/**
 * @openapi
 * /templates/{id}/preview:
 *   post:
 *     tags: [Templates]
 *     summary: Render a live preview PDF without persisting a document
 *     description: Pass `layoutJson` to preview an unsaved Designer draft directly, or `versionId` to preview a persisted version; omitting both previews the template's latest version.
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
 *               versionId: { type: string }
 *               layoutJson: { type: object }
 *               sampleData: { type: object, additionalProperties: true, default: {} }
 *     responses:
 *       '200':
 *         description: The rendered PDF
 *         content:
 *           application/pdf: { schema: { type: string, format: binary } }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '422':
 *         $ref: '#/components/responses/ValidationError'
 */
templatesRouter.post(
  '/:id/preview',
  requirePermission('templates:read'),
  validate(previewTemplateSchema),
  templatesController.preview,
);

/**
 * @openapi
 * /templates/{id}/versions:
 *   get:
 *     tags: [Templates]
 *     summary: List a template's versions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       '200':
 *         description: Paginated list of versions, newest first
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: array, items: { type: object } }
 *                 meta: { $ref: '#/components/schemas/PaginationMeta' }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
templatesRouter.get(
  '/:id/versions',
  requirePermission('templates:version'),
  templatesController.versions.list,
);

/**
 * @openapi
 * /templates/{id}/versions:
 *   post:
 *     tags: [Templates]
 *     summary: Save a new draft version
 *     description: 'Optimistic concurrency: pass `baseVersionNumber` as the version the client last loaded — if it''s stale, the request is rejected with `409 STALE_VERSION` rather than silently overwriting a concurrent edit. Omit it to save unconditionally.'
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [layoutJson]
 *             properties:
 *               layoutJson: { type: object, description: 'See docs/PRD/04-template-json-schema.md' }
 *               changeNote: { type: string, maxLength: 500 }
 *               baseVersionNumber: { type: integer }
 *     responses:
 *       '201':
 *         description: New version saved
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
 *       '409':
 *         description: '`baseVersionNumber` is stale — someone else saved a newer version first'
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       '422':
 *         description: Invalid layout JSON, e.g. two elements sharing the same id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
templatesRouter.post(
  '/:id/versions',
  requirePermission('templates:version'),
  validate(saveTemplateVersionSchema),
  recordAudit('template.version.save', 'template'),
  templatesController.versions.save,
);

// Must come before "/:id/versions/:versionId" — both are 3-segment paths and Express resolves
// in registration order, so the static "compare" segment would otherwise be swallowed as :versionId.
/**
 * @openapi
 * /templates/{id}/versions/compare:
 *   get:
 *     tags: [Templates]
 *     summary: Structurally diff two versions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Added/removed/modified element ids between the two versions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     added: { type: array, items: { type: string } }
 *                     removed: { type: array, items: { type: string } }
 *                     modified:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           changedKeys: { type: array, items: { type: string } }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
templatesRouter.get(
  '/:id/versions/compare',
  requirePermission('templates:version'),
  templatesController.versions.compare,
);

/**
 * @openapi
 * /templates/{id}/versions/{versionId}:
 *   get:
 *     tags: [Templates]
 *     summary: Get a specific version
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: versionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: The version
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
 */
templatesRouter.get(
  '/:id/versions/:versionId',
  requirePermission('templates:version'),
  templatesController.versions.get,
);

/**
 * @openapi
 * /templates/{id}/versions/{versionId}/publish:
 *   post:
 *     tags: [Templates]
 *     summary: Publish a version, making it the template's current live version
 *     description: Rejected if the version references a since-deleted asset (broken literal reference) — fix the reference and retry.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: versionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Template now published, pointing at this version
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
 *         description: The version references an asset that no longer exists
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
templatesRouter.post(
  '/:id/versions/:versionId/publish',
  requirePermission('templates:publish'),
  recordAudit('template.publish', 'template'),
  templatesController.versions.publish,
);

/**
 * @openapi
 * /templates/{id}/versions/{versionId}/restore:
 *   post:
 *     tags: [Templates]
 *     summary: Roll back to an older version, publishing it as a new forward version
 *     description: Never rewrites history — restoring version 2 over version 5 creates version 6 with version 2's content, then publishes it.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: versionId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: The new version (a copy of the restored one) is now published
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
 */
templatesRouter.post(
  '/:id/versions/:versionId/restore',
  requirePermission('templates:publish'),
  recordAudit('template.rollback', 'template'),
  templatesController.versions.restore,
);
