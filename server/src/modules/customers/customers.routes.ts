import { Router } from 'express';
import { createCustomerSchema, updateCustomerSchema } from '@platform/shared';

import { authenticate } from '../../middleware/authenticate';
import { recordAudit } from '../../middleware/audit';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';

import { customersController } from './customers.controller';

export const customersRouter = Router();

customersRouter.use(authenticate);

customersRouter.get('/', requirePermission('customers:read'), customersController.list);
customersRouter.get('/:id', requirePermission('customers:read'), customersController.get);
customersRouter.post(
  '/',
  requirePermission('customers:write'),
  validate(createCustomerSchema),
  recordAudit('customer.create', 'customer'),
  customersController.create,
);
customersRouter.patch(
  '/:id',
  requirePermission('customers:write'),
  validate(updateCustomerSchema),
  recordAudit('customer.update', 'customer'),
  customersController.update,
);
customersRouter.delete(
  '/:id',
  requirePermission('customers:delete'),
  recordAudit('customer.delete', 'customer'),
  customersController.remove,
);
