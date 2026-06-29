export const NOTIFICATION_TYPES = [
  'document.generated',
  'document.failed',
  'batch.completed',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
