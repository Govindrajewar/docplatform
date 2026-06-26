import type { Request, Response } from 'express';
import multer from 'multer';
import { ASSET_TYPES, type AssetType } from '@platform/shared';

import { AppError } from '../../utils/app-error';
import { sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';
import { requireParam } from '../../utils/require-param';

import { assetsService } from './assets.service';

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
}).single('file');

function requireAuth(req: Request) {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.user;
}

function parseAssetType(value: unknown): AssetType {
  if (typeof value !== 'string' || !ASSET_TYPES.includes(value as AssetType)) {
    throw new AppError('VALIDATION_ERROR', `"type" must be one of: ${ASSET_TYPES.join(', ')}`);
  }
  return value as AssetType;
}

export const assetsController = {
  upload: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    if (!req.file)
      throw new AppError('VALIDATION_ERROR', 'No file was uploaded (expected field "file")');

    const asset = await assetsService.upload(
      { organizationId: actor.organizationId },
      {
        type: parseAssetType(req.body.type),
        originalFilename: req.file.originalname,
        buffer: req.file.buffer,
        uploadedBy: actor.userId,
      },
    );
    sendSuccess(res, asset, { status: 201 });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const type = typeof req.query.type === 'string' ? (req.query.type as AssetType) : undefined;
    const { items, meta } = await assetsService.list(
      { organizationId: actor.organizationId },
      page,
      limit,
      type,
    );
    sendSuccess(res, items, { meta });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const asset = await assetsService.get(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
    );
    sendSuccess(res, asset);
  }),

  getFile: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const { asset, buffer } = await assetsService.getFile(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
    );
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${asset.originalFilename}"`);
    res.send(buffer);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    await assetsService.remove(
      { organizationId: actor.organizationId },
      requireParam(req.params.id, 'id'),
    );
    sendSuccess(res, { message: 'Asset deleted' });
  }),
};
