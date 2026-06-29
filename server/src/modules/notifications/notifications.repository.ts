import type { PaginationMeta } from '@platform/shared';

import { NotificationModel, type NotificationDocument } from '../../models/notification.model';
import type { TenantContext } from '../users/users.repository';

export interface CreateNotificationInput {
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
}

export const notificationsRepository = {
  async create(input: CreateNotificationInput): Promise<NotificationDocument> {
    const doc = await NotificationModel.create(input);
    return doc.toObject();
  },

  async list(
    ctx: TenantContext,
    userId: string,
    { page, limit, unreadOnly }: { page: number; limit: number; unreadOnly: boolean },
  ): Promise<{ items: NotificationDocument[]; meta: PaginationMeta }> {
    const query: Record<string, unknown> = { organizationId: ctx.organizationId, userId };
    if (unreadOnly) query.isRead = false;

    const [items, total] = await Promise.all([
      NotificationModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      NotificationModel.countDocuments(query),
    ]);

    return {
      items,
      meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  },

  async countUnread(ctx: TenantContext, userId: string): Promise<number> {
    return NotificationModel.countDocuments({
      organizationId: ctx.organizationId,
      userId,
      isRead: false,
    });
  },

  async markRead(
    ctx: TenantContext,
    userId: string,
    id: string,
  ): Promise<NotificationDocument | null> {
    return NotificationModel.findOneAndUpdate(
      { _id: id, organizationId: ctx.organizationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true },
    ).lean();
  },

  async markAllRead(ctx: TenantContext, userId: string): Promise<void> {
    await NotificationModel.updateMany(
      { organizationId: ctx.organizationId, userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  },
};
