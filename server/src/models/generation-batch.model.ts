import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const batchFailureSchema = new Schema(
  {
    row: { type: Number, required: true },
    reason: { type: String, required: true },
  },
  { _id: false },
);

const generationBatchSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    templateId: { type: Schema.Types.ObjectId, ref: 'Template', required: true },
    totalCount: { type: Number, required: true },
    completedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    failures: { type: [batchFailureSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export type GenerationBatchDocument = InferSchemaType<typeof generationBatchSchema> & {
  _id: Types.ObjectId;
};

export const GenerationBatchModel = model('GenerationBatch', generationBatchSchema);
