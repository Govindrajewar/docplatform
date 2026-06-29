import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate';

import { searchController } from './search.controller';

export const searchRouter = Router();

/**
 * @openapi
 * /search:
 *   get:
 *     tags: [Search]
 *     summary: Cross-entity search (customers, users)
 *     description: Each entity type is only searched if the caller holds its read permission — e.g. a Viewer without `users:read` never gets user results back, even if requested.
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Returns `{}` if blank
 *       - in: query
 *         name: types
 *         schema: { type: string, example: 'customers,users' }
 *         description: Comma-separated subset of searchable types; defaults to all
 *     responses:
 *       '200':
 *         description: Results grouped by entity type
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     customers: { type: array, items: { type: object } }
 *                     users: { type: array, items: { type: object } }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
searchRouter.get('/', authenticate, searchController.search);
