import { Types } from 'mongoose';
import type { DocumentStatus, Permission } from '@platform/shared';

import { AssetModel } from '../../models/asset.model';
import { CustomerModel } from '../../models/customer.model';
import { DocumentModel } from '../../models/document.model';
import { GeneratedPdfModel } from '../../models/generated-pdf.model';
import { TemplateModel } from '../../models/template.model';
import { auditLogsRepository } from '../audit-logs/audit-logs.repository';
import type { TenantContext } from '../users/users.repository';

const DOCUMENTS_OVER_TIME_DAYS = 14;
const RECENT_DOCUMENTS_LIMIT = 5;
const RECENT_ACTIVITY_LIMIT = 10;

function lastNDays(n: number): string[] {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - i);
    days.push(date.toISOString().slice(0, 10));
  }
  return days;
}

/** A single read-only aggregate view, available to every role (PRD 01 §1: even Viewer sees the
 * dashboard) — but `recentActivity` (raw audit-log entries, which include IP/user-agent/diffs)
 * is only included when the actor actually holds `logs:read`, matching the same restriction
 * the dedicated Audit Logs page enforces, rather than leaking it through a side door. */
export async function getDashboardSummary(ctx: TenantContext, actorPermissions: Permission[]) {
  const orgFilter = { organizationId: ctx.organizationId };
  // Mongoose casts query filters (`.find()`/`.countDocuments()`) against the schema
  // automatically, but does NOT cast `$match` stages inside `.aggregate()` pipelines — those
  // need an explicit ObjectId, or a string `organizationId` silently matches nothing.
  const orgObjectId = new Types.ObjectId(ctx.organizationId);
  const aggOrgFilter = { organizationId: orgObjectId };
  const days = lastNDays(DOCUMENTS_OVER_TIME_DAYS);
  const since = new Date(`${days[0]}T00:00:00.000Z`);

  const [
    totalCustomers,
    totalTemplates,
    publishedTemplates,
    documentStatusCounts,
    totalAssets,
    assetSizeAgg,
    pdfSizeAgg,
    documentsPerDayAgg,
    recentDocuments,
  ] = await Promise.all([
    CustomerModel.countDocuments({ ...orgFilter, isArchived: false }),
    TemplateModel.countDocuments(orgFilter),
    TemplateModel.countDocuments({ ...orgFilter, status: 'published' }),
    DocumentModel.aggregate<{ _id: DocumentStatus; count: number }>([
      { $match: { ...aggOrgFilter, isDeleted: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    AssetModel.countDocuments(orgFilter),
    AssetModel.aggregate<{ total: number }>([
      { $match: aggOrgFilter },
      { $group: { _id: null, total: { $sum: '$sizeBytes' } } },
    ]),
    GeneratedPdfModel.aggregate<{ total: number }>([
      {
        $lookup: {
          from: DocumentModel.collection.name,
          localField: 'documentId',
          foreignField: '_id',
          as: 'document',
        },
      },
      { $unwind: '$document' },
      { $match: { 'document.organizationId': orgObjectId } },
      { $group: { _id: null, total: { $sum: '$fileSizeBytes' } } },
    ]),
    DocumentModel.aggregate<{ _id: string; count: number }>([
      { $match: { ...aggOrgFilter, isDeleted: false, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    DocumentModel.find({ ...orgFilter, isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(RECENT_DOCUMENTS_LIMIT)
      .lean(),
  ]);

  const documentsByStatus: Record<DocumentStatus, number> = {
    draft: 0,
    generating: 0,
    generated: 0,
    failed: 0,
  };
  for (const row of documentStatusCounts) documentsByStatus[row._id] = row.count;

  const countByDay = new Map(documentsPerDayAgg.map((row) => [row._id, row.count]));
  const documentsOverTime = days.map((date) => ({ date, count: countByDay.get(date) ?? 0 }));

  const assetsStorageBytes = assetSizeAgg[0]?.total ?? 0;
  const documentsStorageBytes = pdfSizeAgg[0]?.total ?? 0;

  let recentActivity: Awaited<ReturnType<typeof auditLogsRepository.list>>['items'] | null = null;
  if (actorPermissions.includes('logs:read')) {
    const result = await auditLogsRepository.list(
      ctx.organizationId,
      {},
      { page: 1, limit: RECENT_ACTIVITY_LIMIT },
    );
    recentActivity = result.items;
  }

  return {
    kpis: {
      totalCustomers,
      totalTemplates,
      publishedTemplates,
      totalDocuments: Object.values(documentsByStatus).reduce((sum, n) => sum + n, 0),
      documentsByStatus,
      totalAssets,
      assetsStorageBytes,
      documentsStorageBytes,
      totalStorageBytes: assetsStorageBytes + documentsStorageBytes,
    },
    documentsOverTime,
    recentDocuments,
    recentActivity,
  };
}
