import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

const notificationSchema = new Schema(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    // Title/message are plain strings computed at creation time, not references — this is what
    // keeps a notification readable after the entity it describes is later deleted (PRD 10
    // §10.9: "still displays with the entity name snapshotted at creation time").
    title: { type: String, required: true },
    message: { type: String, required: true },
    entityType: { type: String, default: null },
    entityId: { type: Schema.Types.ObjectId, default: null },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export type NotificationDocument = InferSchemaType<typeof notificationSchema> & {
  _id: Types.ObjectId;
};

export const NotificationModel = model('Notification', notificationSchema);
