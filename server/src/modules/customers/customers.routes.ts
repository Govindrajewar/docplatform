import { Router } from 'express';
import { createCustomerSchema, updateCustomerSchema } from '@platform/shared';

import { authenticate } from '../../middleware/authenticate';
import { recordAudit } from '../../middleware/audit';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';

import { customersController } from './customers.controller';

export const customersRouter = Router();

customersRouter.use(authenticate);

/**
 * @openapi
 * /customers:
 *   get:
 *     tags: [Customers]
 *     summary: List customers (excludes archived by default)
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
 *         description: Free-text search by name or email
 *     responses:
 *       '200':
 *         description: Paginated list of customers
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
customersRouter.get('/', requirePermission('customers:read'), customersController.list);

/**
 * @openapi
 * /customers/{id}:
 *   get:
 *     tags: [Customers]
 *     summary: Get a single customer
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: The customer
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
customersRouter.get('/:id', requirePermission('customers:read'), customersController.get);

/**
 * @openapi
 * /customers:
 *   post:
 *     tags: [Customers]
 *     summary: Create a customer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 200, example: Acme Corp }
 *               email: { type: string, format: email, example: billing@acme.test }
 *               phone: { type: string, example: '+1-555-0100' }
 *               address:
 *                 type: object
 *                 properties:
 *                   line1: { type: string }
 *                   line2: { type: string }
 *                   city: { type: string }
 *                   state: { type: string }
 *                   postalCode: { type: string }
 *                   country: { type: string }
 *               metadata: { type: object, additionalProperties: { type: string } }
 *     responses:
 *       '201':
 *         description: Customer created
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
customersRouter.post(
  '/',
  requirePermission('customers:write'),
  validate(createCustomerSchema),
  recordAudit('customer.create', 'customer'),
  customersController.create,
);

/**
 * @openapi
 * /customers/{id}:
 *   patch:
 *     tags: [Customers]
 *     summary: Update a customer
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
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *     responses:
 *       '200':
 *         description: Updated customer
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
customersRouter.patch(
  '/:id',
  requirePermission('customers:write'),
  validate(updateCustomerSchema),
  recordAudit('customer.update', 'customer'),
  customersController.update,
);

/**
 * @openapi
 * /customers/{id}:
 *   delete:
 *     tags: [Customers]
 *     summary: Soft-delete (archive) a customer
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Customer archived
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
customersRouter.delete(
  '/:id',
  requirePermission('customers:delete'),
  recordAudit('customer.delete', 'customer'),
  customersController.remove,
);
