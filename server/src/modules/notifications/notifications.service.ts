import type { NotificationType, PaginationMeta } from '@platform/shared';

import type { NotificationDocument } from '../../models/notification.model';
import { UserModel } from '../../models/user.model';
import { enqueueEmailJob } from '../../queues/email.queue';
import { AppError } from '../../utils/app-error';
import type { TenantContext } from '../users/users.repository';

import { notificationsRepository, type CreateNotificationInput } from './notifications.repository';

export const notificationsService = {
  async list(
    ctx: TenantContext,
    userId: string,
    page: number,
    limit: number,
    unreadOnly: boolean,
  ): Promise<{ items: NotificationDocument[]; meta: PaginationMeta }> {
    return notificationsRepository.list(ctx, userId, { page, limit, unreadOnly });
  },

  async countUnread(ctx: TenantContext, userId: string): Promise<number> {
    return notificationsRepository.countUnread(ctx, userId);
  },

  async markRead(ctx: TenantContext, userId: string, id: string): Promise<NotificationDocument> {
    const updated = await notificationsRepository.markRead(ctx, userId, id);
    if (!updated) throw new AppError('NOT_FOUND', 'Notification not found');
    return updated;
  },

  async markAllRead(ctx: TenantContext, userId: string): Promise<void> {
    await notificationsRepository.markAllRead(ctx, userId);
  },

  /** The single call site every event trigger (document generated/failed, batch completed, ...)
   * goes through: writes the in-app row and enqueues the email job side by side, so a caller
   * never has to remember to do both. If the recipient has no email on file (PRD 10 §10.9's
   * "invited-but-incomplete account" edge case), the email half is skipped silently — the
   * schema currently always requires `email`, but this guard costs nothing and matches the PRD's
   * documented behavior if that ever changes. */
  async notify(
    input: CreateNotificationInput & { type: NotificationType; emailSubject: string },
  ): Promise<void> {
    await notificationsRepository.create(input);

    const recipient = await UserModel.findById(input.userId).lean();
    if (!recipient?.email) return;

    await enqueueEmailJob({
      to: recipient.email,
      subject: input.emailSubject,
      text: input.message,
    });
  },
};
