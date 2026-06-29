import type { Request, Response } from 'express';

import { AppError } from '../../utils/app-error';
import { sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import { requireParam } from '../../utils/require-param';

import { fieldDefinitionsService } from './field-definitions.service';

function requireAuth(req: Request) {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.user;
}

export const fieldDefinitionsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const fields = await fieldDefinitionsService.list({ organizationId: actor.organizationId });
    sendSuccess(res, fields);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const field = await fieldDefinitionsService.create(
      { organizationId: actor.organizationId },
      req.body,
    );
    sendSuccess(res, field, { status: 201 });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const field = await fieldDefinitionsService.update(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
      req.body,
    );
    sendSuccess(res, field);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    await fieldDefinitionsService.remove(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
    );
    sendSuccess(res, { message: 'Field definition deleted' });
  }),
};
