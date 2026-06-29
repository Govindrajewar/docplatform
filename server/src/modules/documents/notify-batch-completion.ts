import { TemplateModel } from '../../models/template.model';
import { notificationsService } from '../notifications/notifications.service';

import { generationBatchesRepository } from './generation-batches.repository';

/** Called after every row outcome (success or failure) is recorded — a no-op until the batch's
 * last row resolves, at which point exactly one summary notification fires (see
 * `claimCompletionNotification`'s atomic-claim guard against the last few rows racing). Also
 * called once right after batch creation, covering the edge case where every row was rejected at
 * validation time before any render job was ever enqueued. */
export async function notifyBatchCompletionIfDone(batchId: string): Promise<void> {
  const batch = await generationBatchesRepository.claimCompletionNotification(batchId);
  if (!batch) return;

  const template = await TemplateModel.findById(batch.templateId).lean();
  const templateName = template?.name ?? 'a template';
  const succeeded = batch.completedCount;
  const failed = batch.failedCount;

  await notificationsService.notify({
    organizationId: batch.organizationId.toString(),
    userId: batch.createdBy.toString(),
    type: 'batch.completed',
    title: 'Bulk generation complete',
    message: `Bulk generation for "${templateName}" finished: ${succeeded} succeeded, ${failed} failed (of ${batch.totalCount}).`,
    entityType: 'generationBatch',
    entityId: batch._id.toString(),
    emailSubject: `Bulk generation complete: ${succeeded}/${batch.totalCount} succeeded`,
  });
}
