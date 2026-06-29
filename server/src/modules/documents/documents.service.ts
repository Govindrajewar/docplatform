import { MAX_IMPORT_ROWS } from '@platform/shared';
import type {
  BulkGenerateInput,
  CreateDocumentInput,
  DocumentStatus,
  TemplateDocument as TemplateLayout,
} from '@platform/shared';

import { GeneratedPdfModel } from '../../models/generated-pdf.model';
import { enqueueRenderJob } from '../../queues/render.queue';
import { storageDriver } from '../../storage';
import { AppError } from '../../utils/app-error';
import { customersRepository } from '../customers/customers.repository';
import { templateVersionsRepository } from '../templates/template-versions/template-versions.repository';
import { templatesRepository } from '../templates/templates.repository';
import type { TenantContext } from '../users/users.repository';

import { isComplexPayload } from './complexity';
import { documentsRepository } from './documents.repository';
import { generationBatchesRepository } from './generation-batches.repository';
import { parseImportFile, suggestColumnMapping } from './import-parsing';
import { renderDocument } from './render-document';
import { validateAndCoerceRow } from './row-validation';

async function loadPublishedVersion(ctx: TenantContext, templateId: string) {
  const template = await templatesRepository.findById(ctx, templateId);
  if (!template) throw new AppError('NOT_FOUND', 'Template not found');
  if (!template.currentVersionId) {
    throw new AppError(
      'VALIDATION_ERROR',
      'This template has no published version yet — publish it before generating documents',
    );
  }

  const version = await templateVersionsRepository.findById(
    ctx,
    template.currentVersionId.toString(),
  );
  if (!version) throw new AppError('INTERNAL_ERROR', 'Published version not found');

  return { template, version, fields: (version.layoutJson as TemplateLayout).fields };
}

/** Decides the sync-fast-path vs. async-queue split (PRD 06 §6.2) and either renders inline
 * (awaited in the request) or hands off to the BullMQ worker — both paths converge on the exact
 * same `renderDocument`, so there is only one rendering implementation to keep correct. */
async function triggerRender(documentId: string, dataPayload: Record<string, unknown>) {
  if (isComplexPayload(dataPayload)) {
    await enqueueRenderJob(documentId);
  } else {
    await renderDocument(documentId);
  }
}

export const documentsService = {
  async list(ctx: TenantContext, options: Parameters<typeof documentsRepository.list>[1]) {
    return documentsRepository.list(ctx, options);
  },

  async get(ctx: TenantContext, id: string) {
    const doc = await documentsRepository.findById(ctx, id);
    if (!doc) throw new AppError('NOT_FOUND', 'Document not found');
    return doc;
  },

  async create(ctx: TenantContext, actorId: string, input: CreateDocumentInput) {
    const { version } = await loadPublishedVersion(ctx, input.templateId);

    const created = await documentsRepository.create({
      organizationId: ctx.organizationId,
      templateId: input.templateId,
      templateVersionId: version._id.toString(),
      customerId: input.customerId ?? null,
      dataPayload: input.dataPayload,
      createdBy: actorId,
    });

    await triggerRender(created._id.toString(), input.dataPayload);

    return this.get(ctx, created._id.toString());
  },

  async regenerate(ctx: TenantContext, id: string) {
    const doc = await this.get(ctx, id);
    await documentsRepository.setStatus(ctx, id, 'generating');
    await triggerRender(id, doc.dataPayload as Record<string, unknown>);
    return this.get(ctx, id);
  },

  async remove(ctx: TenantContext, id: string) {
    const removed = await documentsRepository.softDelete(ctx, id);
    if (!removed) throw new AppError('NOT_FOUND', 'Document not found');
  },

  async getPdf(ctx: TenantContext, id: string) {
    const doc = await this.get(ctx, id);

    if (doc.status === 'generating') {
      throw new AppError('NOT_READY', 'This document is still generating');
    }
    if (doc.status === 'failed') {
      throw new AppError('CONFLICT', `Generation failed: ${doc.failureReason ?? 'unknown error'}`);
    }
    if (doc.status !== ('generated' satisfies DocumentStatus) || !doc.generatedPdfId) {
      throw new AppError('NOT_FOUND', 'This document has not been generated yet');
    }

    const pdf = await GeneratedPdfModel.findById(doc.generatedPdfId).lean();
    if (!pdf) throw new AppError('NOT_FOUND', 'Generated PDF record not found');

    const buffer = await storageDriver.read(pdf.storageKey);
    return { buffer, pdf };
  },

  async importPreview(ctx: TenantContext, templateId: string, file: Express.Multer.File) {
    const { fields } = await loadPublishedVersion(ctx, templateId);
    const parsed = await parseImportFile(file.buffer, file.originalname);

    if (parsed.rows.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'The file contains no data rows');
    }
    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Import is capped at ${MAX_IMPORT_ROWS} rows (file has ${parsed.rows.length})`,
      );
    }

    return {
      columns: parsed.columns,
      rows: parsed.rows,
      suggestedMapping: suggestColumnMapping(parsed.columns, fields),
    };
  },

  /** Bulk-generate always enqueues (PRD 06 §6.3 step N: "Enqueue N render jobs") rather than
   * using the sync/async complexity split `create()` uses — a request generating hundreds of
   * documents must never block on hundreds of synchronous renders. */
  async bulkGenerate(ctx: TenantContext, actorId: string, input: BulkGenerateInput) {
    const { version, fields } = await loadPublishedVersion(ctx, input.templateId);

    const accepted: {
      dataPayload: Record<string, unknown>;
      customerId: string | null;
      row: number;
    }[] = [];
    const failures: { row: number; reason: string }[] = [];

    for (let row = 0; row < input.rows.length; row += 1) {
      const result = validateAndCoerceRow(input.rows[row] ?? {}, fields);
      if (!result.ok) {
        failures.push({ row, reason: result.reason ?? 'Validation failed' });
        continue;
      }
      if (result.customerId) {
        const customer = await customersRepository.findById(ctx, result.customerId);
        if (!customer) {
          failures.push({ row, reason: `Customer "${result.customerId}" not found` });
          continue;
        }
      }
      accepted.push({ dataPayload: result.dataPayload, customerId: result.customerId, row });
    }

    const batch = await generationBatchesRepository.create({
      organizationId: ctx.organizationId,
      templateId: input.templateId,
      totalCount: input.rows.length,
      failedCount: failures.length,
      failures,
      createdBy: actorId,
    });

    for (const acceptedRow of accepted) {
      const created = await documentsRepository.create({
        organizationId: ctx.organizationId,
        templateId: input.templateId,
        templateVersionId: version._id.toString(),
        customerId: acceptedRow.customerId,
        dataPayload: acceptedRow.dataPayload,
        createdBy: actorId,
        batchId: batch._id.toString(),
        batchRowIndex: acceptedRow.row,
      });
      await enqueueRenderJob(created._id.toString());
    }

    return {
      batchId: batch._id.toString(),
      total: input.rows.length,
      accepted: accepted.length,
      rejected: failures,
    };
  },

  async getBatch(ctx: TenantContext, batchId: string) {
    const batch = await generationBatchesRepository.findById(ctx, batchId);
    if (!batch) throw new AppError('NOT_FOUND', 'Batch not found');

    return {
      batchId: batch._id.toString(),
      total: batch.totalCount,
      completed: batch.completedCount,
      failed: batch.failedCount,
      failures: batch.failures,
    };
  },
};
