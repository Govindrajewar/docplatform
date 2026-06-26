import { AppError } from './app-error';

/** Route params are typed loosely (possibly undefined/array) by Express's generic ParamsDictionary. */
export function requireParam(value: string | string[] | undefined, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError('VALIDATION_ERROR', `Missing required route parameter: ${name}`);
  }
  return value;
}
