import { Router } from 'express';

import { authenticate } from '../../middleware/authenticate';

import { notificationsController } from './notifications.controller';

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);

/**
 * @openapi
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List the caller's own notifications
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: boolean, default: false }
 *     responses:
 *       '200':
 *         description: Paginated list of notifications, newest first
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
notificationsRouter.get('/', notificationsController.list);

/**
 * @openapi
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get the caller's unread notification count
 *     responses:
 *       '200':
 *         description: The unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, properties: { count: { type: integer, example: 3 } } }
 *                 error: { nullable: true, example: null }
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 */
notificationsRouter.get('/unread-count', notificationsController.unreadCount);

/**
 * @openapi
 * /notifications/read-all:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark all of the caller's notifications as read
 *     responses:
 *       '200':
 *         description: All notifications marked read
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
 */
notificationsRouter.post('/read-all', notificationsController.markAllRead);

/**
 * @openapi
 * /notifications/{id}/read:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark a single notification as read
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Updated notification
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
notificationsRouter.post('/:id/read', notificationsController.markRead);
