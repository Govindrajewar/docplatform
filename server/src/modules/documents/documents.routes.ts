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

/**
 * @openapi
 * /documents:
 *   get:
 *     tags: [Documents]
 *     summary: List documents (excludes soft-deleted)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: templateId
 *         schema: { type: string }
 *       - in: query
 *         name: customerId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, generating, generated, failed] }
 *     responses:
 *       '200':
 *         description: Paginated list of documents
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
documentsRouter.get('/', requirePermission('documents:read'), documentsController.list);

/**
 * @openapi
 * /documents:
 *   post:
 *     tags: [Documents]
 *     summary: Generate a single document from a published template
 *     description: Small payloads render synchronously and return `status:"generated"` (or `"failed"`) immediately; payloads over the row-count complexity threshold are routed to the async render queue and return `status:"generating"` — poll `GET /documents/{id}` for the outcome.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [templateId]
 *             properties:
 *               templateId: { type: string }
 *               customerId: { type: string }
 *               dataPayload: { type: object, additionalProperties: true }
 *     responses:
 *       '201':
 *         description: Document created (status reflects whether it rendered synchronously)
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
 *         description: The template has no published version yet, or the request body fails validation
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
documentsRouter.post(
  '/',
  requirePermission('documents:generate'),
  validate(createDocumentSchema),
  recordAudit('document.generate', 'document'),
  documentsController.create,
);

// Data import / bulk-generate (PRD 05 §5.8).
/**
 * @openapi
 * /documents/import:
 *   post:
 *     tags: [Documents]
 *     summary: Preview a CSV/Excel/JSON import and suggest a column-to-field mapping
 *     description: Stateless — parses the file and returns a suggested mapping against the template's currently published version fields; nothing is persisted yet.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [templateId, file]
 *             properties:
 *               templateId: { type: string }
 *               file: { type: string, format: binary, description: 'CSV, XLSX, or JSON' }
 *     responses:
 *       '200':
 *         description: Parsed columns/rows and a suggested mapping
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     columns: { type: array, items: { type: string } }
 *                     rows: { type: array, items: { type: object } }
 *                     suggestedMapping: { type: object, additionalProperties: { type: string, nullable: true } }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '422':
 *         description: No data rows, too many rows, or the template has no published version
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
documentsRouter.post(
  '/import',
  requirePermission('documents:generate'),
  importUploadMiddleware,
  documentsController.importPreview,
);

/**
 * @openapi
 * /documents/bulk-generate:
 *   post:
 *     tags: [Documents]
 *     summary: Generate documents for many rows at once
 *     description: Every row is validated independently — invalid rows are reported in `rejected` rather than failing the whole batch. Always enqueues asynchronously (never the sync fast-path), and is rate-limited to 5/min per user. Poll `GET /documents/batches/{batchId}` for progress.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [templateId, rows]
 *             properties:
 *               templateId: { type: string }
 *               rows:
 *                 type: array
 *                 items: { type: object, additionalProperties: true }
 *                 description: Each row is keyed by a field's dotted key, plus an optional reserved `customerId`
 *     responses:
 *       '201':
 *         description: Batch created; valid rows enqueued for rendering
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     batchId: { type: string }
 *                     total: { type: integer }
 *                     accepted: { type: integer }
 *                     rejected:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties: { row: { type: integer }, reason: { type: string } }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '422':
 *         $ref: '#/components/responses/ValidationError'
 *       '429':
 *         description: Too many bulk-generate requests from this user in the last minute
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
documentsRouter.post(
  '/bulk-generate',
  requirePermission('documents:generate'),
  bulkGenerateRateLimit,
  validate(bulkGenerateSchema),
  recordAudit('document.bulk-generate', 'document'),
  documentsController.bulkGenerate,
);

/**
 * @openapi
 * /documents/batches/{batchId}:
 *   get:
 *     tags: [Documents]
 *     summary: Get live progress for a bulk-generate batch
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Current batch progress
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     batchId: { type: string }
 *                     total: { type: integer }
 *                     completed: { type: integer }
 *                     failed: { type: integer }
 *                     failures:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties: { row: { type: integer }, reason: { type: string } }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
documentsRouter.get(
  '/batches/:batchId',
  requirePermission('documents:read'),
  documentsController.getBatch,
);

/**
 * @openapi
 * /documents/{id}:
 *   get:
 *     tags: [Documents]
 *     summary: Get a single document
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: The document
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
documentsRouter.get('/:id', requirePermission('documents:read'), documentsController.get);

/**
 * @openapi
 * /documents/{id}/pdf:
 *   get:
 *     tags: [Documents]
 *     summary: Download the generated PDF
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: The PDF file
 *         content:
 *           application/pdf: { schema: { type: string, format: binary } }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         description: Document not found, or not yet generated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       '409':
 *         description: Still generating (`NOT_READY`), or generation failed (`CONFLICT`, with the failure reason)
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
documentsRouter.get(
  '/:id/pdf',
  requirePermission('documents:download'),
  documentsController.getPdf,
);

/**
 * @openapi
 * /documents/{id}/regenerate:
 *   post:
 *     tags: [Documents]
 *     summary: Re-render a document against its originally pinned template version
 *     description: Always re-renders against `templateVersionId` as it was at creation time, even if the template has since been republished — so a regenerated document stays reproducible.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Regeneration started/completed (status reflects sync vs. async)
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
documentsRouter.post(
  '/:id/regenerate',
  requirePermission('documents:generate'),
  recordAudit('document.regenerate', 'document'),
  documentsController.regenerate,
);

/**
 * @openapi
 * /documents/{id}:
 *   delete:
 *     tags: [Documents]
 *     summary: Soft-delete a document
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Document deleted
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
 */
documentsRouter.delete(
  '/:id',
  requirePermission('documents:delete'),
  recordAudit('document.delete', 'document'),
  documentsController.remove,
);
