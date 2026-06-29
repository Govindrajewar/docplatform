import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const generatedPdfSchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, unique: true },
    storageKey: { type: String, required: true },
    fileSizeBytes: { type: Number, required: true },
    pageCount: { type: Number, required: true },
    checksum: { type: String, required: true },
    generatedAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: false },
);

export type GeneratedPdfDocument = InferSchemaType<typeof generatedPdfSchema> & {
  _id: Types.ObjectId;
};

export const GeneratedPdfModel = model('GeneratedPdf', generatedPdfSchema);
