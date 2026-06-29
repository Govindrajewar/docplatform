import type { FieldDefinition } from '../schemas/template';

/**
 * Always-available system fields (PRD 04 §4.6) — distinct from org-scoped custom fields, which
 * live in the `field_definitions` collection. These are never persisted; the Field Definitions
 * API merges this list with an org's custom fields on every read.
 */
export const SYSTEM_FIELDS: readonly FieldDefinition[] = [
  {
    key: 'customer.name',
    label: 'Customer Name',
    type: 'text',
    system: true,
    required: true,
    defaultValue: null,
  },
  {
    key: 'customer.address',
    label: 'Customer Address',
    type: 'text',
    system: true,
    required: false,
    defaultValue: null,
  },
  {
    key: 'customer.email',
    label: 'Customer Email',
    type: 'text',
    system: true,
    required: false,
    defaultValue: null,
  },
  {
    key: 'customer.phone',
    label: 'Customer Phone',
    type: 'text',
    system: true,
    required: false,
    defaultValue: null,
  },
  {
    key: 'customer.accountNumber',
    label: 'Account Number',
    type: 'text',
    system: true,
    required: false,
    defaultValue: null,
  },
  {
    key: 'organization.name',
    label: 'Organization Name',
    type: 'text',
    system: true,
    required: false,
    defaultValue: null,
  },
  {
    key: 'organization.branch',
    label: 'Organization Branch',
    type: 'text',
    system: true,
    required: false,
    defaultValue: null,
  },
  {
    key: 'document.referenceNumber',
    label: 'Reference Number',
    type: 'text',
    system: true,
    required: false,
    defaultValue: null,
  },
  {
    key: 'document.narration',
    label: 'Narration',
    type: 'text',
    system: true,
    required: false,
    defaultValue: null,
  },
  {
    key: 'document.status',
    label: 'Status',
    type: 'text',
    system: true,
    required: false,
    defaultValue: null,
  },
  {
    key: 'document.statementDate',
    label: 'Statement Date',
    type: 'date',
    system: true,
    required: false,
    defaultValue: null,
  },
  {
    key: 'document.transactionDate',
    label: 'Transaction Date',
    type: 'date',
    system: true,
    required: false,
    defaultValue: null,
  },
  {
    key: 'document.openingBalance',
    label: 'Opening Balance',
    type: 'currency',
    system: true,
    required: false,
    defaultValue: null,
  },
  {
    key: 'document.closingBalance',
    label: 'Closing Balance',
    type: 'currency',
    system: true,
    required: false,
    defaultValue: null,
  },
  {
    key: 'document.amount',
    label: 'Amount',
    type: 'currency',
    system: true,
    required: false,
    defaultValue: null,
  },
];

export const SYSTEM_FIELD_KEYS = new Set(SYSTEM_FIELDS.map((f) => f.key));

/** Custom fields are namespaced under `custom.` to avoid colliding with system field keys (PRD 04 §4.6). */
export const CUSTOM_FIELD_KEY_PATTERN = /^custom\.[a-zA-Z][a-zA-Z0-9_]*$/;
