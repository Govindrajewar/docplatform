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
  ): Promise<void> {
    if (outcome.success) {
      await GenerationBatchModel.updateOne({ _id: batchId }, { $inc: { completedCount: 1 } });
      return;
    }
    await GenerationBatchModel.updateOne(
      { _id: batchId },
      {
        $inc: { failedCount: 1 },
        $push: { failures: { row: outcome.row, reason: outcome.reason } },
      },
    );
  },
};
