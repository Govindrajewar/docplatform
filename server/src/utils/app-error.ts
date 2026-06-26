import type { ApiFieldError, ErrorCode } from '@platform/shared';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  ACCOUNT_SUSPENDED: 403,
  ORGANIZATION_INACTIVE: 403,
  TOKEN_EXPIRED: 401,
  INVALID_TOKEN: 400,
  LAST_ADMIN: 409,
};

/** Thrown anywhere in the request lifecycle; caught and shaped by the centralized error handler — see PRD 08 §8.2. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ApiFieldError[];

  constructor(code: ErrorCode, message: string, details?: ApiFieldError[]) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}
