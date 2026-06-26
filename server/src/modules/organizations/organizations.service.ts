import type { UpdateOrganizationInput } from '@platform/shared';

import { AppError } from '../../utils/app-error';
import type { OrganizationDocument } from '../../models/organization.model';

import { organizationsRepository } from './organizations.repository';

export const organizationsService = {
  async get(organizationId: string): Promise<OrganizationDocument> {
    const org = await organizationsRepository.findById(organizationId);
    if (!org) throw new AppError('NOT_FOUND', 'Organization not found');
    return org;
  },

  async update(
    organizationId: string,
    input: UpdateOrganizationInput,
  ): Promise<OrganizationDocument> {
    const updated = await organizationsRepository.updateById(organizationId, input);
    if (!updated) throw new AppError('NOT_FOUND', 'Organization not found');
    return updated;
  },
};
