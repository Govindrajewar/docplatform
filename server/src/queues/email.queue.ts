import { Queue } from 'bullmq';

import type { MailMessage } from '../config/mail';

import { buildQueueConnection } from './redis-connection';

export type EmailJobData = MailMessage;

let queue: Queue<EmailJobData> | null = null;

function getEmailQueue(): Queue<EmailJobData> {
  queue ??= new Queue<EmailJobData>('email', {
    connection: buildQueueConnection(),
  });
  return queue;
}

/** Per PRD 10 §10.9: SMTP outages are transient, so retry with backoff rather than failing the
 * triggering request — the caller (e.g. forgot-password) has already returned a response by the
 * time this job even runs. */
export async function enqueueEmailJob(message: EmailJobData): Promise<void> {
  await getEmailQueue().add('email', message, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: 100,
  });
}
