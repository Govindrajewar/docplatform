import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const roleSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, lowercase: true, trim: true },
    permissions: { type: [String], default: [] },
    isSystemRole: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type RoleDocument = InferSchemaType<typeof roleSchema> & { _id: Types.ObjectId };

export const RoleModel = model('Role', roleSchema);
