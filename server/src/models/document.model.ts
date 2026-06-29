import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { DOCUMENT_STATUSES } from '@platform/shared';

const documentSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    templateId: { type: Schema.Types.ObjectId, ref: 'Template', required: true, index: true },
    // Pinned at creation time — regenerate always re-renders against this exact version, even if
    // the template has since been republished, so a historical document is always reproducible.
    templateVersionId: { type: Schema.Types.ObjectId, ref: 'TemplateVersion', required: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
    dataPayload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: DOCUMENT_STATUSES, default: 'draft' },
    generatedPdfId: { type: Schema.Types.ObjectId, ref: 'GeneratedPdf', default: null },
    failureReason: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false },
  },
  // minimize:false — an empty dataPayload ({}) is a valid, common case (fully static
  // templates with no dynamic fields); Mongoose's default minimize would otherwise strip it
  // to undefined before the `required` validator runs, rejecting a legitimate empty payload.
  { timestamps: true, minimize: false },
);

documentSchema.index({ organizationId: 1, createdAt: -1 });
documentSchema.index({ organizationId: 1, templateId: 1 });
documentSchema.index({ organizationId: 1, status: 1 });

export type DocumentDocument = InferSchemaType<typeof documentSchema> & { _id: Types.ObjectId };

export const DocumentModel = model('Document', documentSchema);
