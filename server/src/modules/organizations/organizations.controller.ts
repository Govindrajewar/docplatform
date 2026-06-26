import type { Request, Response } from 'express';

import { AppError } from '../../utils/app-error';
import { sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';

import { organizationsService } from './organizations.service';

function requireAuth(req: Request) {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.user;
}

export const organizationsController = {
  getMine: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const org = await organizationsService.get(actor.organizationId);
    sendSuccess(res, org);
  }),

  updateMine: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const org = await organizationsService.update(actor.organizationId, req.body);
    sendSuccess(res, org);
  }),
};
