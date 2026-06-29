import crypto from 'crypto';

import { PDFDocument as PdfLibDocument } from 'pdf-lib';
import { v4 as uuidv4 } from 'uuid';
import type { TemplateDocument as TemplateLayout } from '@platform/shared';

import { logger } from '../../config/logger';
import { render } from '../../engine/render';
import { DocumentModel } from '../../models/document.model';
import { GeneratedPdfModel } from '../../models/generated-pdf.model';
import { TemplateVersionModel } from '../../models/template-version.model';
import { storageDriver } from '../../storage';
import { buildAssetMap, collectPreviewAssetReferences } from '../templates/asset-references';

import { generationBatchesRepository } from './generation-batches.repository';

/**
 * The single rendering path shared by the synchronous fast-path (awaited inline in the create
 * request) and the BullMQ worker (consuming the async queue) — see PRD 06 §6.2. Operating on a
 * bare `documentId` (no `TenantContext`) is a deliberate exception to the usual "every repository
 * call is org-scoped" rule: this function only ever runs *after* the document was already created
 * through a tenant-scoped request, so by the time it runs the org boundary has already been
 * enforced once; a worker process has no per-request actor to scope to anyway.
 */
export async function renderDocument(documentId: string): Promise<void> {
  const doc = await DocumentModel.findById(documentId);
  if (!doc) {
    logger.warn('renderDocument: document not found', { documentId });
    return;
  }

  // Idempotency guard (PRD 10 §10.5): a duplicate delivery of an already-*succeeded* job is a
  // no-op. A `failed` document is intentionally re-processable, both by a BullMQ retry and by an
  // explicit /regenerate call — only `generated` (terminal success) short-circuits here.
  if (doc.status === 'generated') {
    logger.info('renderDocument: already generated, skipping', { documentId });
    return;
  }

  try {
    const version = await TemplateVersionModel.findById(doc.templateVersionId).lean();
    if (!version) throw new Error(`Template version ${doc.templateVersionId} not found`);

    const layoutJson = version.layoutJson as TemplateLayout;
    const ctx = { organizationId: doc.organizationId.toString() };
    const assetIds = collectPreviewAssetReferences(layoutJson, doc.dataPayload);
    const assets = await buildAssetMap(ctx, assetIds);

    const buffer = await render({ template: layoutJson, data: doc.dataPayload, assets });
    const pageCount = (await PdfLibDocument.load(buffer)).getPageCount();
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const storageKey = `${doc.organizationId.toString()}/documents/${uuidv4()}.pdf`;
    await storageDriver.save(storageKey, buffer);

    // Upsert, not create — `documentId` is unique on GeneratedPdf, and `regenerate` re-renders
    // the same document, which would otherwise hit a duplicate-key error on the second pass.
    const generatedPdf = await GeneratedPdfModel.findOneAndUpdate(
      { documentId: doc._id },
      {
        documentId: doc._id,
        storageKey,
        fileSizeBytes: buffer.length,
        pageCount,
        checksum,
        generatedAt: new Date(),
      },
      { upsert: true, new: true },
    );

    doc.status = 'generated';
    doc.generatedPdfId = generatedPdf._id;
    doc.failureReason = null;
    await doc.save();

    if (doc.batchId) {
      await generationBatchesRepository.recordOutcome(doc.batchId.toString(), { success: true });
    }
  } catch (err) {
    logger.error('renderDocument failed', { documentId, err });
    const failureReason = err instanceof Error ? err.message : 'Unknown rendering error';
    doc.status = 'failed';
    doc.failureReason = failureReason;
    await doc.save();

    if (doc.batchId) {
      await generationBatchesRepository.recordOutcome(doc.batchId.toString(), {
        success: false,
        row: doc.batchRowIndex ?? -1,
        reason: failureReason,
      });
    }
  }
}
