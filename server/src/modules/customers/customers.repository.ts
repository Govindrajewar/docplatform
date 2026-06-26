import type { PaginationMeta } from '@platform/shared';

import { CustomerModel, type CustomerDocument } from '../../models/customer.model';
import type { TenantContext } from '../users/users.repository';

export interface CustomerCreateInput {
  organizationId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: Record<string, string | undefined>;
  metadata?: Record<string, string>;
}

export type CustomerUpdateInput = Partial<Omit<CustomerCreateInput, 'organizationId'>>;

export const customersRepository = {
  async create(data: CustomerCreateInput): Promise<CustomerDocument> {
    const doc = await CustomerModel.create(data);
    return doc.toObject({ flattenMaps: true }) as CustomerDocument;
  },

  async findById(ctx: TenantContext, id: string): Promise<CustomerDocument | null> {
    return CustomerModel.findOne({
      _id: id,
      organizationId: ctx.organizationId,
      isArchived: false,
    }).lean();
  },

  async list(
    ctx: TenantContext,
    { page, limit, q }: { page: number; limit: number; q?: string },
  ): Promise<{ items: CustomerDocument[]; meta: PaginationMeta }> {
    const filter: Record<string, unknown> = {
      organizationId: ctx.organizationId,
      isArchived: false,
    };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      CustomerModel.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CustomerModel.countDocuments(filter),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  async updateById(
    ctx: TenantContext,
    id: string,
    update: CustomerUpdateInput,
  ): Promise<CustomerDocument | null> {
    return CustomerModel.findOneAndUpdate(
      { _id: id, organizationId: ctx.organizationId, isArchived: false },
      update,
      { new: true },
    ).lean();
  },

  async archive(ctx: TenantContext, id: string): Promise<CustomerDocument | null> {
    return CustomerModel.findOneAndUpdate(
      { _id: id, organizationId: ctx.organizationId },
      { isArchived: true },
      { new: true },
    ).lean();
  },

  async searchByName(ctx: TenantContext, q: string, limit: number): Promise<CustomerDocument[]> {
    return CustomerModel.find({
      organizationId: ctx.organizationId,
      isArchived: false,
      name: { $regex: q, $options: 'i' },
    })
      .limit(limit)
      .lean();
  },
};
