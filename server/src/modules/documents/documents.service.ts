import type { CreateDocumentInput, DocumentStatus } from '@platform/shared';

import { GeneratedPdfModel } from '../../models/generated-pdf.model';
import { enqueueRenderJob } from '../../queues/render.queue';
import { storageDriver } from '../../storage';
import { AppError } from '../../utils/app-error';
import { templateVersionsRepository } from '../templates/template-versions/template-versions.repository';
import { templatesRepository } from '../templates/templates.repository';
import type { TenantContext } from '../users/users.repository';

import { isComplexPayload } from './complexity';
import { documentsRepository } from './documents.repository';
import { renderDocument } from './render-document';

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
    const template = await templatesRepository.findById(ctx, input.templateId);
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
};
