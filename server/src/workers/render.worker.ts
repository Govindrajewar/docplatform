import { Worker } from 'bullmq';

import { logger } from '../config/logger';
import { renderDocument } from '../modules/documents/render-document';
import { buildQueueConnection } from '../queues/redis-connection';
import type { RenderJobData } from '../queues/render.queue';

/** The process entrypoint (`npm run worker`, see `workers/index.ts`) wires this up; it shares
 * `renderDocument` with the synchronous fast-path so there is exactly one rendering code path. */
export function createRenderWorker(): Worker<RenderJobData> {
  const worker = new Worker<RenderJobData>(
    'render',
    async (job) => {
      await renderDocument(job.data.documentId);
    },
    { connection: buildQueueConnection() },
  );

  worker.on('completed', (job) => logger.info('Render job completed', { jobId: job.id }));
  worker.on('failed', (job, err) => logger.error('Render job failed', { jobId: job?.id, err }));

  return worker;
}
