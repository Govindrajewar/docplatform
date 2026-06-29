import type { Request, Response } from 'express';

import { AppError } from '../../utils/app-error';
import { sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import { requireParam } from '../../utils/require-param';

import { notificationsService } from './notifications.service';

function requireAuth(req: Request) {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.user;
}

export const notificationsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const unreadOnly = req.query.unreadOnly === 'true';
    const { items, meta } = await notificationsService.list(
      { organizationId: actor.organizationId },
      actor.userId,
      page,
      limit,
      unreadOnly,
    );
    sendSuccess(res, items, { meta });
  }),

  unreadCount: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const count = await notificationsService.countUnread(
      { organizationId: actor.organizationId },
      actor.userId,
    );
    sendSuccess(res, { count });
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const notification = await notificationsService.markRead(
      { organizationId: actor.organizationId },
      actor.userId,
      requireParam(req.params.id, 'id'),
    );
    sendSuccess(res, notification);
  }),

  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    await notificationsService.markAllRead({ organizationId: actor.organizationId }, actor.userId);
    sendSuccess(res, { message: 'All notifications marked as read' });
  }),
};
