import type { Request, Response } from 'express';

import { AppError } from '../../utils/app-error';
import { sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';

import { settingsService } from './settings.service';

function requireAuth(req: Request) {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.user;
}

export const settingsController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const settings = await settingsService.get(actor.organizationId);
    sendSuccess(res, settings);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const settings = await settingsService.update(actor.organizationId, req.body);
    sendSuccess(res, settings);
  }),
};
