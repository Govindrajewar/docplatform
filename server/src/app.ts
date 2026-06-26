import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env';
import { swaggerSpec } from './config/swagger';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { requestContext } from './middleware/request-context';
import { auditLogsRouter } from './modules/audit-logs/audit-logs.routes';
import { authRouter } from './modules/auth/auth.routes';
import { assetsRouter } from './modules/assets/assets.routes';
import { customersRouter } from './modules/customers/customers.routes';
import { healthRouter } from './modules/health/health.routes';
import { organizationsRouter } from './modules/organizations/organizations.routes';
import { searchRouter } from './modules/search/search.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { usersRouter } from './modules/users/users.routes';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(requestContext);

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use('/', healthRouter);

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', usersRouter);
  app.use('/api/v1/organizations', organizationsRouter);
  app.use('/api/v1/settings', settingsRouter);
  app.use('/api/v1/audit-logs', auditLogsRouter);
  app.use('/api/v1/customers', customersRouter);
  app.use('/api/v1/assets', assetsRouter);
  app.use('/api/v1/search', searchRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
