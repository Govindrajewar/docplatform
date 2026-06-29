import type { Request, Response } from 'express';

import { AppError } from '../../utils/app-error';
import { sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';

import { getDashboardSummary } from './dashboard.service';

function requireAuth(req: Request) {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.user;
}

export const dashboardController = {
  summary: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const summary = await getDashboardSummary(
      { organizationId: actor.organizationId },
      actor.permissions,
    );
    sendSuccess(res, summary);
  }),
};
