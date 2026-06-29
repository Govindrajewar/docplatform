import { Router } from 'express';
import { createUserSchema, updateUserSchema } from '@platform/shared';

import { authenticate } from '../../middleware/authenticate';
import { recordAudit } from '../../middleware/audit';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';

import { usersController } from './users.controller';

export const usersRouter = Router();

usersRouter.use(authenticate);

/**
 * @openapi
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List users in the caller's organization
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       '200':
 *         description: Paginated list of users
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
usersRouter.get('/', requirePermission('users:read'), usersController.list);

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     tags: [Users]
 *     summary: Get a single user
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: The user
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
usersRouter.get('/:id', requirePermission('users:read'), usersController.get);

/**
 * @openapi
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Invite a new user to the organization
 *     description: Creates the user in `invited` status and emails a set-password link. Managers cannot grant the Admin role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, role]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 120, example: Edie Editor }
 *               email: { type: string, format: email, example: edie@acme.test }
 *               role: { type: string, enum: [admin, manager, editor, viewer], example: editor }
 *     responses:
 *       '201':
 *         description: User invited
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
 *         description: Lacks `users:write`, or a Manager is trying to grant the Admin role
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       '409':
 *         description: An account with this email already exists
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       '422':
 *         $ref: '#/components/responses/ValidationError'
 */
usersRouter.post(
  '/',
  requirePermission('users:write'),
  validate(createUserSchema),
  recordAudit('user.create', 'user'),
  usersController.create,
);

/**
 * @openapi
 * /users/{id}:
 *   patch:
 *     tags: [Users]
 *     summary: Update a user's name, role, or status
 *     description: Demoting the last Admin, or suspending/deleting the org's last active Admin, is rejected (`LAST_ADMIN`).
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
 *               name: { type: string, minLength: 2, maxLength: 120 }
 *               role: { type: string, enum: [admin, manager, editor, viewer] }
 *               status: { type: string, enum: [active, invited, suspended, deleted] }
 *     responses:
 *       '200':
 *         description: Updated user
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
 *       '409':
 *         description: Would leave the organization with no active Admin
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 *       '422':
 *         $ref: '#/components/responses/ValidationError'
 */
usersRouter.patch(
  '/:id',
  requirePermission('users:write'),
  validate(updateUserSchema),
  recordAudit('user.update', 'user'),
  usersController.update,
);

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     tags: [Users]
 *     summary: Remove a user (soft-delete — sets status to `deleted`)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: User removed
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
 *       '403':
 *         $ref: '#/components/responses/Forbidden'
 *       '404':
 *         $ref: '#/components/responses/NotFound'
 *       '409':
 *         description: Would leave the organization with no active Admin
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
usersRouter.delete(
  '/:id',
  requirePermission('users:delete'),
  recordAudit('user.delete', 'user'),
  usersController.remove,
);
