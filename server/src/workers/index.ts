import { connectDatabase } from '../config/db';
import { logger } from '../config/logger';

import { createEmailWorker } from './email.worker';
import { createRenderWorker } from './render.worker';

async function main(): Promise<void> {
  await connectDatabase();
  createRenderWorker();
  logger.info('Render worker started, listening on the "render" queue');
  createEmailWorker();
  logger.info('Email worker started, listening on the "email" queue');
}

main().catch((err) => {
  logger.error('Worker failed to start', { err });
  process.exit(1);
});
