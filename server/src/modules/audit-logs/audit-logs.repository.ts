import type { PaginationMeta } from '@platform/shared';

import { AuditLogModel, type AuditLogDocument } from '../../models/audit-log.model';

export interface CreateAuditLogInput {
  organizationId: string;
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditLogFilters {
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  from?: Date;
  to?: Date;
}

export const auditLogsRepository = {
  async create(input: CreateAuditLogInput): Promise<void> {
    await AuditLogModel.create(input);
  },

  async list(
    organizationId: string,
    filters: AuditLogFilters,
    { page, limit }: { page: number; limit: number },
  ): Promise<{ items: AuditLogDocument[]; meta: PaginationMeta }> {
    const query: Record<string, unknown> = { organizationId };
    if (filters.actorId) query.actorId = filters.actorId;
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.entityId) query.entityId = filters.entityId;
    if (filters.action) query.action = filters.action;
    if (filters.from || filters.to) {
      query.createdAt = {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      };
    }

    const [items, total] = await Promise.all([
      AuditLogModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLogModel.countDocuments(query),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  async findById(organizationId: string, id: string): Promise<AuditLogDocument | null> {
    return AuditLogModel.findOne({ _id: id, organizationId }).lean();
  },
};
