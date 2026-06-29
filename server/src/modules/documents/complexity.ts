/** Render time scales with row count far more than anything else (table pagination, font
 * embedding per page). A flat row-count heuristic is a coarse but defensible stand-in for the
 * PRD's "estimated render time < ~800ms" rule (PRD 06 §6.2) without actually rendering twice. */
const SYNC_ROW_THRESHOLD = 200;

function countRows(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length + value.reduce((sum: number, item) => sum + countRows(item), 0);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).reduce((sum: number, item) => sum + countRows(item), 0);
  }
  return 0;
}

export function isComplexPayload(dataPayload: Record<string, unknown>): boolean {
  return countRows(dataPayload) > SYNC_ROW_THRESHOLD;
}
