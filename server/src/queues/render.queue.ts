import { Queue } from 'bullmq';

import { buildRenderQueueConnection } from './redis-connection';

export interface RenderJobData {
  documentId: string;
}

let queue: Queue<RenderJobData> | null = null;

/**
 * Lazily constructed on first use — nothing in the request path touches Redis/BullMQ unless a
 * document actually crosses the async-complexity threshold (see documents.service.ts), which
 * means the test suite's small sync-path payloads never instantiate this at all.
 */
function getRenderQueue(): Queue<RenderJobData> {
  queue ??= new Queue<RenderJobData>('render', {
    connection: buildRenderQueueConnection(),
  });
  return queue;
}

/** Per PRD 06 §6.2 failure path: at most 2 automatic retries (3 attempts total) — render
 * failures are almost always deterministic data/template problems, not transient infra blips. */
export async function enqueueRenderJob(documentId: string): Promise<void> {
  await getRenderQueue().add(
    'render',
    { documentId },
    {
      // BullMQ dedupes by jobId — re-enqueuing the same document while its job is still
      // queued/active is a no-op, a second layer of idempotency above the worker's own check.
      jobId: documentId,
      attempts: 3,
      backoff: { type: 'fixed', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
}
