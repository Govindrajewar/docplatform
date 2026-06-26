import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const organizationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logoAssetId: { type: Schema.Types.ObjectId, ref: 'Asset', default: null },
    primaryColor: { type: String, default: '#002970' },
    secondaryColor: { type: String, default: '#6B7280' },
    headerDefaults: { type: Schema.Types.Mixed, default: {} },
    footerDefaults: { type: Schema.Types.Mixed, default: {} },
    defaultFontFamily: { type: String, default: 'Inter' },
    defaultCurrency: { type: String, default: 'USD' },
    defaultTimezone: { type: String, default: 'UTC' },
    defaultPaperSize: { type: String, enum: ['A4', 'LETTER', 'LEGAL'], default: 'A4' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type OrganizationDocument = InferSchemaType<typeof organizationSchema> & {
  _id: Types.ObjectId;
};

export const OrganizationModel = model('Organization', organizationSchema);
