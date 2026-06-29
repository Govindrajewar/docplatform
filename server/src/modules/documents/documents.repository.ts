import type { DocumentStatus, PaginationMeta } from '@platform/shared';

import { DocumentModel, type DocumentDocument } from '../../models/document.model';
import type { TenantContext } from '../users/users.repository';

export interface DocumentCreateInput {
  organizationId: string;
  templateId: string;
  templateVersionId: string;
  customerId?: string | null;
  dataPayload: Record<string, unknown>;
  createdBy: string;
}

export const documentsRepository = {
  async create(data: DocumentCreateInput): Promise<DocumentDocument> {
    const doc = await DocumentModel.create({ ...data, status: 'generating' });
    return doc.toObject();
  },

  async findById(ctx: TenantContext, id: string): Promise<DocumentDocument | null> {
    return DocumentModel.findOne({
      _id: id,
      organizationId: ctx.organizationId,
      isDeleted: false,
    }).lean();
  },

  async list(
    ctx: TenantContext,
    {
      page,
      limit,
      templateId,
      customerId,
      status,
    }: {
      page: number;
      limit: number;
      templateId?: string;
      customerId?: string;
      status?: DocumentStatus;
    },
  ): Promise<{ items: DocumentDocument[]; meta: PaginationMeta }> {
    const filter: Record<string, unknown> = {
      organizationId: ctx.organizationId,
      isDeleted: false,
    };
    if (templateId) filter.templateId = templateId;
    if (customerId) filter.customerId = customerId;
    if (status) filter.status = status;

    const [items, total] = await Promise.all([
      DocumentModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      DocumentModel.countDocuments(filter),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  async setStatus(
    ctx: TenantContext,
    id: string,
    status: DocumentStatus,
  ): Promise<DocumentDocument | null> {
    return DocumentModel.findOneAndUpdate(
      { _id: id, organizationId: ctx.organizationId },
      { status, failureReason: null },
      { new: true },
    ).lean();
  },

  async softDelete(ctx: TenantContext, id: string): Promise<DocumentDocument | null> {
    return DocumentModel.findOneAndUpdate(
      { _id: id, organizationId: ctx.organizationId, isDeleted: false },
      { isDeleted: true },
      { new: true },
    ).lean();
  },
};
