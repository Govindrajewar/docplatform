import type { PaginationMeta, TemplateStatus } from '@platform/shared';

import { TemplateModel, type TemplateDocument } from '../../models/template.model';
import type { TenantContext } from '../users/users.repository';

export interface TemplateCreateInput {
  organizationId: string;
  name: string;
  documentType: string;
  tags?: string[];
  createdBy: string;
}

export type TemplateMetadataUpdate = Partial<
  Pick<TemplateCreateInput, 'name' | 'documentType' | 'tags'>
>;

export const templatesRepository = {
  async create(data: TemplateCreateInput): Promise<TemplateDocument> {
    const doc = await TemplateModel.create(data);
    return doc.toObject();
  },

  async findById(ctx: TenantContext, id: string): Promise<TemplateDocument | null> {
    return TemplateModel.findOne({ _id: id, organizationId: ctx.organizationId }).lean();
  },

  async list(
    ctx: TenantContext,
    {
      page,
      limit,
      q,
      documentType,
      status,
    }: { page: number; limit: number; q?: string; documentType?: string; status?: TemplateStatus },
  ): Promise<{ items: TemplateDocument[]; meta: PaginationMeta }> {
    const filter: Record<string, unknown> = { organizationId: ctx.organizationId };
    if (documentType) filter.documentType = documentType;
    if (status) filter.status = status;
    if (q) filter.name = { $regex: q, $options: 'i' };

    const [items, total] = await Promise.all([
      TemplateModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      TemplateModel.countDocuments(filter),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  async updateMetadata(
    ctx: TenantContext,
    id: string,
    update: TemplateMetadataUpdate,
  ): Promise<TemplateDocument | null> {
    return TemplateModel.findOneAndUpdate({ _id: id, organizationId: ctx.organizationId }, update, {
      new: true,
    }).lean();
  },

  async setStatus(
    ctx: TenantContext,
    id: string,
    status: TemplateStatus,
  ): Promise<TemplateDocument | null> {
    return TemplateModel.findOneAndUpdate(
      { _id: id, organizationId: ctx.organizationId },
      { status },
      { new: true },
    ).lean();
  },

  async setCurrentVersion(
    ctx: TenantContext,
    id: string,
    currentVersionId: string,
  ): Promise<TemplateDocument | null> {
    return TemplateModel.findOneAndUpdate(
      { _id: id, organizationId: ctx.organizationId },
      { currentVersionId, status: 'published' },
      { new: true },
    ).lean();
  },
};
