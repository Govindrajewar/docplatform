/** Stable machine-readable error codes — see PRD 05 §5.4. Frontend branches on these, never on message text. */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'ACCOUNT_SUSPENDED',
  'ORGANIZATION_INACTIVE',
  'TOKEN_EXPIRED',
  'INVALID_TOKEN',
  'LAST_ADMIN',
  'STALE_VERSION',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
