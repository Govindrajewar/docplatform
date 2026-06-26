import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

type RequestPart = 'body' | 'query' | 'params';

/** Validates req[part] against a shared Zod schema; replaces it with the parsed (coerced) value. */
export function validate(schema: ZodSchema, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req[part] = schema.parse(req[part]);
    next();
  };
}
