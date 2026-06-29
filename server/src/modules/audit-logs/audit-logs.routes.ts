import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/require-permission';

import { auditLogsController } from './audit-logs.controller';

export const auditLogsRouter = Router();

auditLogsRouter.use(authenticate, requirePermission('logs:read'));

/**
 * @openapi
 * /audit-logs:
 *   get:
 *     tags: [Audit Logs]
 *     summary: List audit log entries
 *     description: Requires `logs:read`, which only Admin and Manager hold by default.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: actorId
 *         schema: { type: string }
 *       - in: query
 *         name: entityType
 *         schema: { type: string, example: document }
 *       - in: query
 *         name: entityId
 *         schema: { type: string }
 *       - in: query
 *         name: action
 *         schema: { type: string, example: document.generate }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *     responses:
 *       '200':
 *         description: Paginated list of audit log entries, newest first
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
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 */
auditLogsRouter.get('/', auditLogsController.list);

/**
 * @openapi
 * /audit-logs/{id}:
 *   get:
 *     tags: [Audit Logs]
 *     summary: Get a single audit log entry
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: The audit log entry
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
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 */
auditLogsRouter.get('/:id', auditLogsController.get);
