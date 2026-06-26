import type { CreateCustomerInput, UpdateCustomerInput } from '@platform/shared';

import { AppError } from '../../utils/app-error';
import type { TenantContext } from '../users/users.repository';

import { customersRepository } from './customers.repository';

export const customersService = {
  async list(ctx: TenantContext, page: number, limit: number, q?: string) {
    return customersRepository.list(ctx, { page, limit, q });
  },

  async get(ctx: TenantContext, id: string) {
    const customer = await customersRepository.findById(ctx, id);
    if (!customer) throw new AppError('NOT_FOUND', 'Customer not found');
    return customer;
  },

  async create(ctx: TenantContext, input: CreateCustomerInput) {
    return customersRepository.create({ organizationId: ctx.organizationId, ...input });
  },

  async update(ctx: TenantContext, id: string, input: UpdateCustomerInput) {
    const updated = await customersRepository.updateById(ctx, id, input);
    if (!updated) throw new AppError('NOT_FOUND', 'Customer not found');
    return updated;
  },

  async remove(ctx: TenantContext, id: string) {
    // Soft-delete: historical documents snapshot their own data at generation time and are
    // unaffected by this, but the live customer record is archived, not erased — see PRD 10 §10.6.
    const archived = await customersRepository.archive(ctx, id);
    if (!archived) throw new AppError('NOT_FOUND', 'Customer not found');
  },
};
