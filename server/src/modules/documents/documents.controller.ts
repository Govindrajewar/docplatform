import type { Request, Response } from 'express';
import multer from 'multer';
import type { DocumentStatus } from '@platform/shared';

import { AppError } from '../../utils/app-error';
import { sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import { requireParam } from '../../utils/require-param';

import { documentsService } from './documents.service';

const MAX_IMPORT_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export const importUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMPORT_FILE_SIZE_BYTES },
}).single('file');

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

  importPreview: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    if (!req.file) {
      throw new AppError('VALIDATION_ERROR', 'No file was uploaded (expected field "file")');
    }
    const templateId = requireParam(
      typeof req.body.templateId === 'string' ? req.body.templateId : undefined,
      'templateId',
    );
    const preview = await documentsService.importPreview(
      { organizationId: actor.organizationId },
      templateId,
      req.file,
    );
    sendSuccess(res, preview);
  }),

  bulkGenerate: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const result = await documentsService.bulkGenerate(
      { organizationId: actor.organizationId },
      actor.userId,
      req.body,
    );
    sendSuccess(res, result, { status: 201 });
  }),

  getBatch: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const batch = await documentsService.getBatch(
      { organizationId: actor.organizationId },
      requireParam(req.params.batchId, 'batchId'),
    );
    sendSuccess(res, batch);
  }),
};
