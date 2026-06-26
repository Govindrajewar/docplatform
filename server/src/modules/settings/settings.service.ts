import type { UpdateSettingsInput } from '@platform/shared';

import { AppError } from '../../utils/app-error';
import { organizationsRepository } from '../organizations/organizations.repository';

export interface OrganizationSettings {
  theme: string;
  language: string;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultPaperSize: string;
}

function toSettings(org: {
  theme: string;
  language: string;
  defaultCurrency: string;
  defaultTimezone: string;
  defaultPaperSize: string;
}): OrganizationSettings {
  return {
    theme: org.theme,
    language: org.language,
    defaultCurrency: org.defaultCurrency,
    defaultTimezone: org.defaultTimezone,
    defaultPaperSize: org.defaultPaperSize,
  };
}

export const settingsService = {
  async get(organizationId: string): Promise<OrganizationSettings> {
    const org = await organizationsRepository.findById(organizationId);
    if (!org) throw new AppError('NOT_FOUND', 'Organization not found');
    return toSettings(org);
  },

  async update(organizationId: string, input: UpdateSettingsInput): Promise<OrganizationSettings> {
    const updated = await organizationsRepository.updateById(organizationId, input);
    if (!updated) throw new AppError('NOT_FOUND', 'Organization not found');
    return toSettings(updated);
  },
};
