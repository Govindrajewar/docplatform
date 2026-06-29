import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const FIELD_TYPES = ['text', 'date', 'currency', 'number', 'boolean'] as const;

const fieldDefinitionSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    // Always under the `custom.` namespace — system fields (PRD 04 §4.6) are hardcoded in
    // shared/constants and never persisted here.
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: FIELD_TYPES, default: 'text' },
    // Always false here — system fields (PRD 04 §4.6) are hardcoded in shared/constants and
    // never persisted; stored explicitly so API responses can distinguish custom from system
    // fields without the caller having to know which collection a field came from.
    system: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    defaultValue: { type: Schema.Types.Mixed, default: null },
    validation: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

fieldDefinitionSchema.index({ organizationId: 1, key: 1 }, { unique: true });

export type FieldDefinitionDocument = InferSchemaType<typeof fieldDefinitionSchema> & {
  _id: Types.ObjectId;
};

export const FieldDefinitionModel = model('FieldDefinition', fieldDefinitionSchema);
