/** Mirrors `server/src/modules/documents/path.ts` — sets a dotted path (e.g. "customer.name")
 * into a nested object, since the rendering engine resolves tokens by walking that same
 * dot-segment structure (see `server/src/engine/resolver/tokens.ts`'s `getByPath`). */
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
