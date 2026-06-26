import winston from 'winston';

import { env } from './env';

const REDACTED_KEYS = new Set([
  'password',
  'newPassword',
  'token',
  'refreshToken',
  'accessToken',
  'authorization',
  'passwordHash',
  'refreshTokenHash',
]);

/** Strips sensitive keys from logged objects before serialization — see PRD 08 §8.1. */
function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value as object)) return '[Circular]';
  seen.add(value as object);

  if (Array.isArray(value)) return value.map((item) => redact(item, seen));

  const output: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    output[key] = REDACTED_KEYS.has(key) ? '[REDACTED]' : redact(val, seen);
  }
  return output;
}

const redactFormat = winston.format((info) => {
  const { level, message, timestamp, ...rest } = info;
  return { level, message, timestamp, ...(redact(rest) as object) };
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    redactFormat(),
    env.NODE_ENV === 'production' ? winston.format.json() : winston.format.simple(),
  ),
  transports: [new winston.transports.Console()],
});
