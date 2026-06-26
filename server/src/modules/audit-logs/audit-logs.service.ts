import { AppError } from '../../utils/app-error';

import { auditLogsRepository, type AuditLogFilters } from './audit-logs.repository';

export const auditLogsService = {
  async list(organizationId: string, filters: AuditLogFilters, page: number, limit: number) {
    return auditLogsRepository.list(organizationId, filters, { page, limit });
  },

  async get(organizationId: string, id: string) {
    const entry = await auditLogsRepository.findById(organizationId, id);
    if (!entry) throw new AppError('NOT_FOUND', 'Audit log entry not found');
    return entry;
  },
};
