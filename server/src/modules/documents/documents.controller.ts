import type { Request, Response } from 'express';
import type { DocumentStatus } from '@platform/shared';

import { AppError } from '../../utils/app-error';
import { sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import { requireParam } from '../../utils/require-param';

import { documentsService } from './documents.service';

function requireAuth(req: Request) {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.user;
}

export const documentsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const { items, meta } = await documentsService.list(
      { organizationId: actor.organizationId },
      {
        page,
        limit,
        templateId: typeof req.query.templateId === 'string' ? req.query.templateId : undefined,
        customerId: typeof req.query.customerId === 'string' ? req.query.customerId : undefined,
        status:
          typeof req.query.status === 'string' ? (req.query.status as DocumentStatus) : undefined,
      },
    );
    sendSuccess(res, items, { meta });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const doc = await documentsService.get(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
    );
    sendSuccess(res, doc);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const doc = await documentsService.create(
      { organizationId: actor.organizationId },
      actor.userId,
      req.body,
    );
    sendSuccess(res, doc, { status: 201 });
  }),

  regenerate: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const doc = await documentsService.regenerate(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
    );
    sendSuccess(res, doc);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    await documentsService.remove(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
    );
    sendSuccess(res, { message: 'Document deleted' });
  }),

  getPdf: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const { buffer } = await documentsService.getPdf(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.send(buffer);
  }),
};
