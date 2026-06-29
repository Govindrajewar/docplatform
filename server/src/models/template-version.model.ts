import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const templateVersionSchema = new Schema(
  {
    // Denormalized from Template so every query here can be tenant-scoped directly, per the
    // "every collection carries organizationId" rule in PRD 03 §3.3 (the PRD's own
    // template_versions field table omits it, which would otherwise require a join to enforce).
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    templateId: { type: Schema.Types.ObjectId, ref: 'Template', required: true, index: true },
    versionNumber: { type: Number, required: true },
    // Full validated Template JSON (PRD 04) — immutable once created; "edits" are always a new doc.
    layoutJson: { type: Schema.Types.Mixed, required: true },
    changeNote: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true },
);

templateVersionSchema.index({ templateId: 1, versionNumber: -1 }, { unique: true });

export type TemplateVersionDocument = InferSchemaType<typeof templateVersionSchema> & {
  _id: Types.ObjectId;
};

export const TemplateVersionModel = model('TemplateVersion', templateVersionSchema);
