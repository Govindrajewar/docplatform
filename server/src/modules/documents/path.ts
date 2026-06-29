/** Sets a dotted path (e.g. "customer.name") into a nested object, creating intermediate
 * objects as needed. Mirrors `getByPath` in `engine/resolver/tokens.ts` — tokens are resolved
 * by walking the same dot-segment structure, so imported data must be nested to match. */
export function setByPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  let cursor: Record<string, unknown> = target;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i] as string;
    const next = cursor[segment];
    if (!next || typeof next !== 'object') {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }

  cursor[segments[segments.length - 1] as string] = value;
}
