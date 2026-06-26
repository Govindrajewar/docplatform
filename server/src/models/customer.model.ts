import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const addressSchema = new Schema(
  {
    line1: { type: String, default: null },
    line2: { type: String, default: null },
    city: { type: String, default: null },
    state: { type: String, default: null },
    postalCode: { type: String, default: null },
    country: { type: String, default: null },
  },
  { _id: false },
);

const customerSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    email: { type: String, default: null, lowercase: true, trim: true },
    phone: { type: String, default: null, trim: true },
    address: { type: addressSchema, default: {} },
    metadata: { type: Map, of: String, default: {} },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

customerSchema.index({ organizationId: 1, isArchived: 1, createdAt: -1 });
customerSchema.index({ organizationId: 1, name: 1 });

// .lean() flattens Mongoose Map fields to plain objects at runtime (FlattenMaps) — model the
// type after what .lean() actually returns, since every repository read goes through .lean().
export type CustomerDocument = Omit<InferSchemaType<typeof customerSchema>, 'metadata'> & {
  _id: Types.ObjectId;
  metadata: Record<string, string>;
};

export const CustomerModel = model('Customer', customerSchema);
