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

/**
 * @openapi
 * /assets:
 *   get:
 *     tags: [Assets]
 *     summary: List assets
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [logo, icon, image, font, signature] }
 *     responses:
 *       '200':
 *         description: Paginated list of assets
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
assetsRouter.get('/', requirePermission('assets:read'), assetsController.list);

/**
 * @openapi
 * /assets/{id}:
 *   get:
 *     tags: [Assets]
 *     summary: Get asset metadata
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: The asset's metadata (not its file contents — see /assets/{id}/file)
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
assetsRouter.get('/:id', requirePermission('assets:read'), assetsController.get);

/**
 * @openapi
 * /assets/{id}/file:
 *   get:
 *     tags: [Assets]
 *     summary: Download the raw asset file (image/font bytes)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: The raw file, with the asset's real MIME type
 *         content:
 *           application/octet-stream: { schema: { type: string, format: binary } }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
assetsRouter.get('/:id/file', requirePermission('assets:read'), assetsController.getFile);

/**
 * @openapi
 * /assets:
 *   post:
 *     tags: [Assets]
 *     summary: Upload an asset
 *     description: The file's real content is sniffed (magic bytes) against the declared `type`'s allow-list, regardless of the claimed MIME type; uploaded SVGs are sanitized; identical content is deduplicated by checksum. Rate-limited to 20/min per user.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, type]
 *             properties:
 *               file: { type: string, format: binary }
 *               type: { type: string, enum: [logo, icon, image, font, signature] }
 *     responses:
 *       '201':
 *         description: Asset uploaded
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
 *         description: File content doesn't match an allowed type for the declared `type`, or exceeds the per-type size limit
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       '429':
 *         description: Too many uploads from this user in the last minute
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
assetsRouter.post(
  '/',
  requirePermission('assets:write'),
  uploadRateLimit,
  uploadMiddleware,
  recordAudit('asset.upload', 'asset'),
  assetsController.upload,
);

/**
 * @openapi
 * /assets/{id}:
 *   delete:
 *     tags: [Assets]
 *     summary: Delete an asset
 *     description: Rejected if the asset is currently referenced by the organization's logo setting.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Asset deleted
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
 *         description: Still referenced by the organization logo
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
assetsRouter.delete(
  '/:id',
  requirePermission('assets:delete'),
  recordAudit('asset.delete', 'asset'),
  assetsController.remove,
);
