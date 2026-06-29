import type { FieldDefinition } from '@platform/shared';

import { setByPath } from './path';

export interface RowValidationResult {
  ok: boolean;
  dataPayload: Record<string, unknown>;
  customerId: string | null;
  reason: string | null;
}

function coerce(field: FieldDefinition, raw: unknown): { value: unknown; error: string | null } {
  if (raw === undefined || raw === null || raw === '') {
    return { value: field.defaultValue, error: null };
  }

  switch (field.type) {
    case 'number':
    case 'currency': {
      const num = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''));
      if (Number.isNaN(num)) return { value: null, error: `"${field.label}" is not a number` };
      return { value: num, error: null };
    }
    case 'date': {
      const date = raw instanceof Date ? raw : new Date(String(raw));
      if (Number.isNaN(date.getTime())) {
        return { value: null, error: `"${field.label}" is not a valid date` };
      }
      return { value: date.toISOString().slice(0, 10), error: null };
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return { value: raw, error: null };
      const normalized = String(raw).trim().toLowerCase();
      if (['true', 'yes', '1'].includes(normalized)) return { value: true, error: null };
      if (['false', 'no', '0'].includes(normalized)) return { value: false, error: null };
      return { value: null, error: `"${field.label}" is not a valid boolean` };
    }
    default: {
      const text = String(raw);
      if (field.validation?.pattern && !new RegExp(field.validation.pattern).test(text)) {
        return { value: null, error: `"${field.label}" does not match the required format` };
      }
      return { value: text, error: null };
    }
  }
}

/** Validates and type-coerces one already-mapped import row (field key -> raw value) against
 * the template's declared `fields[]`, building the nested dataPayload the rendering engine
 * expects (see `engine/resolver/tokens.ts`'s dot-path resolution). One bad row never aborts the
 * whole batch (PRD 10 §10.6) — the caller records `reason` against that row and moves on. */
export function validateAndCoerceRow(
  row: Record<string, unknown>,
  fields: readonly FieldDefinition[],
): RowValidationResult {
  const dataPayload: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = row[field.key];

    if (field.required && (raw === undefined || raw === null || raw === '')) {
      return {
        ok: false,
        dataPayload: {},
        customerId: null,
        reason: `"${field.label}" is required`,
      };
    }

    const { value, error } = coerce(field, raw);
    if (error) {
      return { ok: false, dataPayload: {}, customerId: null, reason: error };
    }
    setByPath(dataPayload, field.key, value);
  }

  const customerIdRaw = row.customerId;
  const customerId =
    typeof customerIdRaw === 'string' && customerIdRaw.trim() ? customerIdRaw : null;

  return { ok: true, dataPayload, customerId, reason: null };
}
