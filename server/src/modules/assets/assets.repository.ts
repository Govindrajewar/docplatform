import type { AssetType, PaginationMeta } from '@platform/shared';

import { AssetModel, type AssetDocument } from '../../models/asset.model';
import type { TenantContext } from '../users/users.repository';

export interface AssetCreateInput {
  organizationId: string;
  type: AssetType;
  originalFilename: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  uploadedBy: string;
  metadata?: Record<string, unknown>;
}

export const assetsRepository = {
  async create(data: AssetCreateInput): Promise<AssetDocument> {
    const doc = await AssetModel.create(data);
    return doc.toObject();
  },

  async findByChecksum(ctx: TenantContext, checksum: string): Promise<AssetDocument | null> {
    return AssetModel.findOne({ organizationId: ctx.organizationId, checksum }).lean();
  },

  async findById(ctx: TenantContext, id: string): Promise<AssetDocument | null> {
    return AssetModel.findOne({ _id: id, organizationId: ctx.organizationId }).lean();
  },

  async list(
    ctx: TenantContext,
    { page, limit, type }: { page: number; limit: number; type?: AssetType },
  ): Promise<{ items: AssetDocument[]; meta: PaginationMeta }> {
    const filter: Record<string, unknown> = { organizationId: ctx.organizationId };
    if (type) filter.type = type;

    const [items, total] = await Promise.all([
      AssetModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AssetModel.countDocuments(filter),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  async deleteById(ctx: TenantContext, id: string): Promise<AssetDocument | null> {
    return AssetModel.findOneAndDelete({ _id: id, organizationId: ctx.organizationId }).lean();
  },
};
