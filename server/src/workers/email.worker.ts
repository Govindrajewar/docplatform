import { Worker } from 'bullmq';

import { sendMail } from '../config/mail';
import { logger } from '../config/logger';
import type { EmailJobData } from '../queues/email.queue';
import { buildQueueConnection } from '../queues/redis-connection';

export function createEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    'email',
    async (job) => {
      await sendMail(job.data);
    },
    { connection: buildQueueConnection() },
  );

  worker.on('completed', (job) => logger.info('Email job completed', { jobId: job.id }));
  worker.on('failed', (job, err) => logger.error('Email job failed', { jobId: job?.id, err }));

  return worker;
}
