/**
 * Merges space-separated id lists (for `aria-describedby` / `aria-labelledby`)
 * into one: each argument is split on whitespace, empties and falsy entries are
 * dropped, duplicates are removed (first occurrence wins), and the rest are
 * joined with a single space. Returns `undefined` when nothing is left, so the
 * attribute is omitted rather than rendered empty.
 *
 * A control that computes its own description ids should pass the consumer's
 * value first and use this instead of overwriting it.
 * @barrelExport
 */
export function mergeDescribedBy(...ids: Array<string | undefined | null | false>): string | undefined {
  const seen = new Set<string>();
  for (const value of ids) {
    if (!value) continue;
    for (const id of value.split(/\s+/)) {
      if (id) seen.add(id);
    }
  }
  return seen.size > 0 ? Array.from(seen).join(' ') : undefined;
}
