import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { TEMPLATE_STATUSES } from '@platform/shared';

const templateSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    documentType: { type: String, required: true, trim: true },
    // `status: 'archived'` is the archive flag — PRD 03 §3.2.5 also lists a separate
    // `isArchived` boolean, but that's redundant with this enum; collapsed to one field.
    status: { type: String, enum: TEMPLATE_STATUSES, default: 'draft' },
    currentVersionId: { type: Schema.Types.ObjectId, ref: 'TemplateVersion', default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tags: { type: [String], default: [] },
  },
  { timestamps: true },
);

templateSchema.index({ organizationId: 1, status: 1, documentType: 1 });
templateSchema.index({ organizationId: 1, name: 'text' });

export type TemplateDocument = InferSchemaType<typeof templateSchema> & { _id: Types.ObjectId };

export const TemplateModel = model('Template', templateSchema);
