import type { Request, Response } from 'express';

import { AppError } from '../../utils/app-error';
import { sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import { requireParam } from '../../utils/require-param';

import { auditLogsService } from './audit-logs.service';

function requireAuth(req: Request) {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.user;
}

export const auditLogsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const { items, meta } = await auditLogsService.list(
      actor.organizationId,
      {
        actorId: typeof req.query.actorId === 'string' ? req.query.actorId : undefined,
        entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
        entityId: typeof req.query.entityId === 'string' ? req.query.entityId : undefined,
        action: typeof req.query.action === 'string' ? req.query.action : undefined,
        from: typeof req.query.from === 'string' ? new Date(req.query.from) : undefined,
        to: typeof req.query.to === 'string' ? new Date(req.query.to) : undefined,
      },
      page,
      limit,
    );
    sendSuccess(res, items, { meta });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const entry = await auditLogsService.get(
      actor.organizationId,
      requireParam(req.params.id, 'id'),
    );
    sendSuccess(res, entry);
  }),
};
