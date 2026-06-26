import type { Response } from 'express';
import type { ApiSuccess, PaginationMeta } from '@platform/shared';

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { status?: number; meta?: PaginationMeta } = {},
): void {
  const body: ApiSuccess<T> = {
    success: true,
    data,
    error: null,
    ...(options.meta ? { meta: options.meta } : {}),
  };
  res.status(options.status ?? 200).json(body);
}
