import crypto from 'crypto';

import FileType from 'file-type';
import * as fontkit from 'fontkit';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import {
  ALLOWED_MIME_TYPES_BY_ASSET_TYPE,
  MAX_ASSET_SIZE_BYTES_BY_TYPE,
  type AssetType,
} from '@platform/shared';

import { AppError } from '../../utils/app-error';
import { storageDriver } from '../../storage';
import { organizationsRepository } from '../organizations/organizations.repository';
import type { TenantContext } from '../users/users.repository';

import { assetsRepository } from './assets.repository';
import { sanitizeSvg } from './svg-sanitizer';

const MAX_IMAGE_DIMENSION_PX = 8000;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'application/font-sfnt': 'ttf',
  'application/x-font-ttf': 'ttf',
};

function looksLikeSvg(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 2000).toString('utf-8');
  return /<svg[\s>]/i.test(head);
}

const FONT_MIME_TYPES = new Set([
  'font/ttf',
  'font/otf',
  'application/font-sfnt',
  'application/x-font-ttf',
]);

/** Confirms the buffer actually parses as a font (rejects renamed/garbage files masquerading
 * as a font via magic bytes alone) and that it exposes at least one renderable glyph — see the
 * Phase 2 TODO deferred to Phase 3 in PRD 08 §8.3. */
function validateFontBuffer(buffer: Buffer): void {
  let parsed: fontkit.Font | fontkit.FontCollection;
  try {
    parsed = fontkit.create(buffer);
  } catch {
    throw new AppError('VALIDATION_ERROR', 'File could not be parsed as a valid font');
  }

  const font = 'fonts' in parsed ? parsed.fonts[0] : parsed;
  if (!font || font.numGlyphs === 0) {
    throw new AppError('VALIDATION_ERROR', 'Font file contains no usable glyphs');
  }
}

/** Sniffs the real MIME from file content — never trusts the client-supplied Content-Type (PRD 08 §8.3). */
async function sniffMimeType(buffer: Buffer, declaredType: AssetType): Promise<string> {
  // SVG is plain XML with no fixed magic bytes — file-type often classifies it as generic
  // "application/xml" rather than failing outright, so the SVG-specific check must run first,
  // not just as a fallback for when detection comes back empty.
  const allowsSvg = ALLOWED_MIME_TYPES_BY_ASSET_TYPE[declaredType].includes('image/svg+xml');
  if (allowsSvg && looksLikeSvg(buffer)) return 'image/svg+xml';

  const detected = await FileType.fromBuffer(buffer);
  if (detected) return detected.mime;

  throw new AppError('VALIDATION_ERROR', 'Could not determine the file type from its content');
}

async function processBuffer(buffer: Buffer, mimeType: string): Promise<Buffer> {
  if (mimeType === 'image/svg+xml') return sanitizeSvg(buffer);

  if (mimeType === 'image/png' || mimeType === 'image/jpeg') {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    if (
      (metadata.width ?? 0) > MAX_IMAGE_DIMENSION_PX ||
      (metadata.height ?? 0) > MAX_IMAGE_DIMENSION_PX
    ) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Image exceeds the maximum dimension of ${MAX_IMAGE_DIMENSION_PX}px`,
      );
    }
    // Re-encoding (without .withMetadata()) strips EXIF/embedded payloads from the original file.
    return mimeType === 'image/png' ? image.png().toBuffer() : image.jpeg().toBuffer();
  }

  if (FONT_MIME_TYPES.has(mimeType)) {
    validateFontBuffer(buffer);
  }

  return buffer;
}

export interface UploadAssetInput {
  type: AssetType;
  originalFilename: string;
  buffer: Buffer;
  uploadedBy: string;
}

export const assetsService = {
  async upload(ctx: TenantContext, input: UploadAssetInput) {
    const maxSize = MAX_ASSET_SIZE_BYTES_BY_TYPE[input.type];
    if (input.buffer.length > maxSize) {
      throw new AppError(
        'VALIDATION_ERROR',
        `File exceeds the maximum size of ${maxSize} bytes for type "${input.type}"`,
      );
    }

    const mimeType = await sniffMimeType(input.buffer, input.type);
    if (!ALLOWED_MIME_TYPES_BY_ASSET_TYPE[input.type].includes(mimeType)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `MIME type "${mimeType}" is not allowed for asset type "${input.type}"`,
      );
    }

    const processed = await processBuffer(input.buffer, mimeType);
    const checksum = crypto.createHash('sha256').update(processed).digest('hex');

    const existing = await assetsRepository.findByChecksum(ctx, checksum);
    if (existing) return existing;

    const extension = EXTENSION_BY_MIME[mimeType] ?? 'bin';
    const storageKey = `${ctx.organizationId}/${input.type}/${uuidv4()}.${extension}`;
    await storageDriver.save(storageKey, processed);

    return assetsRepository.create({
      organizationId: ctx.organizationId,
      type: input.type,
      originalFilename: input.originalFilename,
      storageKey,
      mimeType,
      sizeBytes: processed.length,
      checksum,
      uploadedBy: input.uploadedBy,
    });
  },

  async list(ctx: TenantContext, page: number, limit: number, type?: AssetType) {
    return assetsRepository.list(ctx, { page, limit, type });
  },

  async get(ctx: TenantContext, id: string) {
    const asset = await assetsRepository.findById(ctx, id);
    if (!asset) throw new AppError('NOT_FOUND', 'Asset not found');
    return asset;
  },

  async getFile(ctx: TenantContext, id: string) {
    const asset = await this.get(ctx, id);
    const buffer = await storageDriver.read(asset.storageKey);
    return { asset, buffer };
  },

  async remove(ctx: TenantContext, id: string) {
    const asset = await this.get(ctx, id);

    const organization = await organizationsRepository.findById(ctx.organizationId);
    if (organization?.logoAssetId?.toString() === id) {
      throw new AppError(
        'CONFLICT',
        'This asset is referenced by the organization logo and cannot be deleted',
      );
    }

    await storageDriver.delete(asset.storageKey);
    await assetsRepository.deleteById(ctx, id);
  },
};
