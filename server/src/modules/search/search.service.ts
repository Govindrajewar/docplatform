import type { Permission } from '@platform/shared';

import { customersRepository } from '../customers/customers.repository';
import { toPublicUser } from '../users/users.mapper';
import { usersRepository, type TenantContext } from '../users/users.repository';

const RESULTS_PER_TYPE = 10;

export const SEARCHABLE_TYPES = ['customers', 'users'] as const;
export type SearchableType = (typeof SEARCHABLE_TYPES)[number];

const REQUIRED_PERMISSION: Record<SearchableType, Permission> = {
  customers: 'customers:read',
  users: 'users:read',
};

export const searchService = {
  /** Each type is only searched if the requester actually holds its :read permission — see PRD 05 §5.12. */
  async search(
    ctx: TenantContext,
    q: string,
    requestedTypes: SearchableType[],
    grantedPermissions: Permission[],
  ): Promise<Record<string, unknown[]>> {
    const granted = new Set(grantedPermissions);
    const types = requestedTypes.filter((type) => granted.has(REQUIRED_PERMISSION[type]));

    const results: Record<string, unknown[]> = {};

    await Promise.all(
      types.map(async (type) => {
        if (type === 'customers') {
          results.customers = await customersRepository.searchByName(ctx, q, RESULTS_PER_TYPE);
        }
        if (type === 'users') {
          const users = await usersRepository.searchByNameOrEmail(ctx, q, RESULTS_PER_TYPE);
          results.users = users.map(toPublicUser);
        }
      }),
    );

    return results;
  },
};
