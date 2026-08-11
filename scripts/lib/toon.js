/**
 * Minimal TOON-style tabular serializer for arrays of uniform flat
 * objects. NOT a general-purpose implementation — only handles the shapes
 * this repo's manifest actually produces (arrays of objects with
 * string/number/boolean fields), used to render `eventBus.channels`
 * compactly in ai-docs/CORE.md.
 *
 * Deliberately hand-rolled instead of depending on the `json-to-toon` npm
 * package: evaluated against this repo's own real data and found to
 * silently corrupt output on two patterns already present in
 * component-manifest.json —
 *  - A value containing a comma (e.g. the payload type string
 *    `Record<string, string>`) isn't quoted/escaped, so the row's column
 *    count is wrong on read-back.
 *  - A value containing a colon (e.g. the event name `theme:changed`)
 *    collides with TOON's own `key: value` delimiter — round-tripping
 *    `{ name: 'theme:changed', payload: '...' }` through that package
 *    produces a completely different, wrong object
 *    (`{ theme: 'changed,...' }`), not a graceful failure.
 * It's also a single-maintainer, single-published-version package with no
 * track record — not something to depend on for anything embedded in an
 * AI-facing manifest. This module quotes any field value containing a
 * comma, colon, newline, or double-quote, doubling internal quotes
 * (CSV-style escaping) so round-tripping stays unambiguous.
 */

function needsQuoting(value) {
  return /[,:\n"]/.test(String(value));
}

function quoteField(value) {
  const str = String(value);
  if (!needsQuoting(str)) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

/** Serialize an array of uniform flat objects (same keys, in the same order) into TOON's `[N]{keys}:` tabular form. */
export function toToon(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const keys = Object.keys(rows[0]);
  const header = `[${rows.length}]{${keys.join(',')}}:`;
  const lines = rows.map((row) => '  ' + keys.map((k) => quoteField(row[k])).join(','));
  return [header, ...lines].join('\n');
}
