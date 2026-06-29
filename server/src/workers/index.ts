import { connectDatabase } from '../config/db';
import { logger } from '../config/logger';

import { createRenderWorker } from './render.worker';

async function main(): Promise<void> {
  await connectDatabase();
  createRenderWorker();
  logger.info('Render worker started, listening on the "render" queue');
}

main().catch((err) => {
  logger.error('Worker failed to start', { err });
  process.exit(1);
});
