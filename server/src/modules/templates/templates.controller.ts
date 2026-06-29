import type { Request, Response } from 'express';
import type { TemplateStatus } from '@platform/shared';

import { AppError } from '../../utils/app-error';
import { sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import { requireParam } from '../../utils/require-param';

import { templatesService } from './templates.service';

function requireAuth(req: Request) {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.user;
}

export const templatesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const { items, meta } = await templatesService.list(
      { organizationId: actor.organizationId },
      {
        page,
        limit,
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        documentType:
          typeof req.query.documentType === 'string' ? req.query.documentType : undefined,
        status:
          typeof req.query.status === 'string' ? (req.query.status as TemplateStatus) : undefined,
      },
    );
    sendSuccess(res, items, { meta });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const result = await templatesService.get(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
    );
    sendSuccess(res, result);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const result = await templatesService.create(
      { organizationId: actor.organizationId },
      actor.userId,
      req.body,
    );
    sendSuccess(res, result, { status: 201 });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const template = await templatesService.updateMetadata(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
      req.body,
    );
    sendSuccess(res, template);
  }),

  archive: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const template = await templatesService.archive(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
    );
    sendSuccess(res, template);
  }),

  duplicate: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const result = await templatesService.duplicate(
      { organizationId: actor.organizationId },
      actor.userId,
      requireParam(req.params.id, 'id'),
    );
    sendSuccess(res, result, { status: 201 });
  }),

  exportBundle: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const bundle = await templatesService.exportBundle(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
    );
    sendSuccess(res, bundle);
  }),

  importBundle: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const result = await templatesService.importBundle(
      { organizationId: actor.organizationId },
      actor.userId,
      req.body,
    );
    sendSuccess(res, result, { status: 201 });
  }),

  preview: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const buffer = await templatesService.preview(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
      req.body,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.send(buffer);
  }),

  versions: {
    list: asyncHandler(async (req: Request, res: Response) => {
      const actor = requireAuth(req);
      const page = Number(req.query.page ?? 1);
      const limit = Math.min(Number(req.query.limit ?? 20), 100);
      const { items, total } = await templatesService.versions.list(
        { organizationId: actor.organizationId },
        requireParam(req.params.id, 'id'),
        { page, limit },
      );
      sendSuccess(res, items, {
        meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
      });
    }),

    get: asyncHandler(async (req: Request, res: Response) => {
      const actor = requireAuth(req);
      const version = await templatesService.versions.get(
        { organizationId: actor.organizationId },
        requireParam(req.params.id, 'id'),
        requireParam(req.params.versionId, 'versionId'),
      );
      sendSuccess(res, version);
    }),

    save: asyncHandler(async (req: Request, res: Response) => {
      const actor = requireAuth(req);
      const version = await templatesService.versions.save(
        { organizationId: actor.organizationId },
        actor.userId,
        requireParam(req.params.id, 'id'),
        req.body,
      );
      sendSuccess(res, version, { status: 201 });
    }),

    publish: asyncHandler(async (req: Request, res: Response) => {
      const actor = requireAuth(req);
      const template = await templatesService.versions.publish(
        { organizationId: actor.organizationId },
        requireParam(req.params.id, 'id'),
        requireParam(req.params.versionId, 'versionId'),
      );
      sendSuccess(res, template);
    }),

    restore: asyncHandler(async (req: Request, res: Response) => {
      const actor = requireAuth(req);
      const result = await templatesService.versions.restore(
        { organizationId: actor.organizationId },
        actor.userId,
        requireParam(req.params.id, 'id'),
        requireParam(req.params.versionId, 'versionId'),
      );
      sendSuccess(res, result, { status: 201 });
    }),

    compare: asyncHandler(async (req: Request, res: Response) => {
      const actor = requireAuth(req);
      const diff = await templatesService.versions.compare(
        { organizationId: actor.organizationId },
        requireParam(req.params.id, 'id'),
        requireParam(typeof req.query.from === 'string' ? req.query.from : undefined, 'from'),
        requireParam(typeof req.query.to === 'string' ? req.query.to : undefined, 'to'),
      );
      sendSuccess(res, diff);
    }),
  },
};
