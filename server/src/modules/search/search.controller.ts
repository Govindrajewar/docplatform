import type { Request, Response } from 'express';

import { AppError } from '../../utils/app-error';
import { sendSuccess } from '../../utils/api-response';
import { asyncHandler } from '../../utils/async-handler';

import { SEARCHABLE_TYPES, searchService, type SearchableType } from './search.service';

function requireAuth(req: Request) {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Authentication required');
  return req.user;
}

function parseTypes(value: unknown): SearchableType[] {
  if (typeof value !== 'string' || value.length === 0) return [...SEARCHABLE_TYPES];
  return value
    .split(',')
    .map((t) => t.trim())
    .filter((t): t is SearchableType => SEARCHABLE_TYPES.includes(t as SearchableType));
}

export const searchController = {
  search: asyncHandler(async (req: Request, res: Response) => {
    const actor = requireAuth(req);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) {
      sendSuccess(res, {});
      return;
    }

    const results = await searchService.search(
      { organizationId: actor.organizationId },
      q,
      parseTypes(req.query.types),
      actor.permissions,
    );
    sendSuccess(res, results);
  }),
};
