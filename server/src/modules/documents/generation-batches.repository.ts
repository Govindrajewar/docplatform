import {
  GenerationBatchModel,
  type GenerationBatchDocument,
} from '../../models/generation-batch.model';
import type { TenantContext } from '../users/users.repository';

export const generationBatchesRepository = {
  async create(data: {
    organizationId: string;
    templateId: string;
    totalCount: number;
    failedCount: number;
    failures: { row: number; reason: string }[];
    createdBy: string;
  }): Promise<GenerationBatchDocument> {
    const doc = await GenerationBatchModel.create(data);
    return doc.toObject();
  },

  async findById(ctx: TenantContext, id: string): Promise<GenerationBatchDocument | null> {
    return GenerationBatchModel.findOne({ _id: id, organizationId: ctx.organizationId }).lean();
  },

  async recordOutcome(
    batchId: string,
    outcome: { success: true } | { success: false; row: number; reason: string },
  ): Promise<GenerationBatchDocument | null> {
    if (outcome.success) {
      return GenerationBatchModel.findOneAndUpdate(
        { _id: batchId },
        { $inc: { completedCount: 1 } },
        { new: true },
      ).lean();
    }
    return GenerationBatchModel.findOneAndUpdate(
      { _id: batchId },
      {
        $inc: { failedCount: 1 },
        $push: { failures: { row: outcome.row, reason: outcome.reason } },
      },
      { new: true },
    ).lean();
  },

  /** Atomically claims the right to send the batch-completion notification — the `notifiedAt:
   * null` filter means this only succeeds once, even if the batch's last few rows finish on
   * different worker ticks around the same moment. Returns the batch only when this call is the
   * one that should notify; returns `null` otherwise (already notified, or not yet complete). */
  async claimCompletionNotification(batchId: string): Promise<GenerationBatchDocument | null> {
    return GenerationBatchModel.findOneAndUpdate(
      {
        _id: batchId,
        notifiedAt: null,
        $expr: { $gte: [{ $add: ['$completedCount', '$failedCount'] }, '$totalCount'] },
      },
      { notifiedAt: new Date() },
      { new: true },
    ).lean();
  },
};
