import type { FieldDefinition } from '@platform/shared';

import type { DataContext } from '../types';

import { getByPath } from './tokens';

export type RequiredFieldBehavior = 'blank' | 'placeholder' | 'fail';

/**
 * Thrown once, after the whole document has been walked, listing every required field that was
 * missing — not just the first one encountered. A 422 that names one of three missing fields and
 * makes the caller fix-and-retry three times is a worse experience than naming all of them up
 * front (PRD 10 §10.4).
 */
export class RequiredFieldsMissingError extends Error {
  constructor(public readonly fieldKeys: string[]) {
    super(
      `Required field(s) missing from the data context with no default value: ${fieldKeys.join(', ')}`,
    );
  }
}

/**
 * Resolves a `dynamicField`/`date`/`currency` element's `fieldKey` against `data.fields.<key>`,
 * falling back to the field's declared `defaultValue`, then applying the element's
 * `requiredFieldBehavior` if the field is required and still unresolved. See PRD 04 §4.4.
 *
 * A `fail` behavior doesn't throw immediately — it records the key into `missingFields` so the
 * caller can collect every missing field across the document and raise a single aggregated
 * error (see {@link RequiredFieldsMissingError}).
 */
export function resolveFieldValue(
  fieldKey: string,
  context: DataContext,
  fields: FieldDefinition[],
  requiredFieldBehavior: RequiredFieldBehavior = 'blank',
  placeholder = '',
  missingFields?: Set<string>,
): unknown {
  const definition = fields.find((field) => field.key === fieldKey);
  let value = getByPath(context, `fields.${fieldKey}`);

  if (value === undefined || value === null) {
    value = definition?.defaultValue ?? undefined;
  }

  if ((value === undefined || value === null || value === '') && definition?.required) {
    switch (requiredFieldBehavior) {
      case 'fail':
        missingFields?.add(fieldKey);
        return '';
      case 'placeholder':
        return placeholder;
      case 'blank':
      default:
        return '';
    }
  }

  return value;
}

const TRUTHY_STRINGS = new Set(['true', '1', 'yes']);

/** Resolves a checkbox's `checked` property, which may be a literal boolean or a `{{token}}`. */
export function resolveCheckboxState(
  checked: boolean | string,
  resolvedTokenValue: string,
): boolean {
  if (typeof checked === 'boolean') return checked;
  return TRUTHY_STRINGS.has(resolvedTokenValue.trim().toLowerCase());
}
