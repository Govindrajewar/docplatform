import type { Request, Response } from 'express';

import { AppError } from '../../utils/app-error';
import { sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import { requireParam } from '../../utils/require-param';

import { customersService } from './customers.service';

function requireAuth(req: Request) {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.user;
}

export const customersController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const { items, meta } = await customersService.list(
      { organizationId: actor.organizationId },
      page,
      limit,
      q,
    );
    sendSuccess(res, items, { meta });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const customer = await customersService.get(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
    );
    sendSuccess(res, customer);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const customer = await customersService.create(
      { organizationId: actor.organizationId },
      req.body,
    );
    sendSuccess(res, customer, { status: 201 });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const customer = await customersService.update(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
      req.body,
    );
    sendSuccess(res, customer);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    await customersService.remove(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
    );
    sendSuccess(res, { message: 'Customer deleted' });
  }),
};
