import { createApp } from './app';
import { connectDatabase } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { connectRedis } from './config/redis';

async function main(): Promise<void> {
  await connectDatabase();
  await connectRedis();

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`, { env: env.NODE_ENV });
  });
}

main().catch((err) => {
  logger.error('Failed to start server', { err });
  process.exit(1);
});
