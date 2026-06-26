import { Router } from 'express';
import { createUserSchema, updateUserSchema } from '@platform/shared';

import { authenticate } from '../../middleware/authenticate';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';

import { usersController } from './users.controller';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get('/', requirePermission('users:read'), usersController.list);
usersRouter.get('/:id', requirePermission('users:read'), usersController.get);
usersRouter.post(
  '/',
  requirePermission('users:write'),
  validate(createUserSchema),
  usersController.create,
);
usersRouter.patch(
  '/:id',
  requirePermission('users:write'),
  validate(updateUserSchema),
  usersController.update,
);
usersRouter.delete('/:id', requirePermission('users:delete'), usersController.remove);
