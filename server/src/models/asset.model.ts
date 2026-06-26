import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { ASSET_TYPES } from '@platform/shared';

const assetSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    type: { type: String, enum: ASSET_TYPES, required: true },
    originalFilename: { type: String, required: true },
    storageKey: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    checksum: { type: String, required: true, index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

assetSchema.index({ organizationId: 1, type: 1 });
assetSchema.index({ organizationId: 1, checksum: 1 });

export type AssetDocument = InferSchemaType<typeof assetSchema> & { _id: Types.ObjectId };

export const AssetModel = model('Asset', assetSchema);
