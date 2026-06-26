import type { NextFunction, Request, Response } from 'express';

import { logger } from '../config/logger';
import { auditLogsRepository } from '../modules/audit-logs/audit-logs.repository';

function extractData(body: unknown): unknown {
  if (body && typeof body === 'object' && 'data' in body) return (body as { data: unknown }).data;
  return body;
}

function extractEntityId(req: Request, body: unknown): string | null {
  if (typeof req.params.id === 'string') return req.params.id;
  const data = extractData(body);
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (typeof record.id === 'string') return record.id;
    if (typeof record._id === 'string') return record._id;
  }
  return null;
}

/**
 * Logs a successful mutation after the response is sent — write failures here are logged and
 * swallowed, never roll back the underlying action (audit is observability, not a transaction
 * participant; see PRD 07 §7.4). Apply per-route, after `authenticate`.
 */
export function recordAudit(action: string, entityType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);

    res.json = ((body: unknown) => {
      const result = originalJson(body);

      if (req.user && res.statusCode >= 200 && res.statusCode < 300) {
        auditLogsRepository
          .create({
            organizationId: req.user.organizationId,
            actorId: req.user.userId,
            action,
            entityType,
            entityId: extractEntityId(req, body),
            after: extractData(body),
            ipAddress: req.ip ?? null,
            userAgent: req.headers['user-agent'] ?? null,
          })
          .catch((err: unknown) =>
            logger.warn('Failed to write audit log', { err, action, entityType }),
          );
      }

      return result;
    }) as Response['json'];

    next();
  };
}
