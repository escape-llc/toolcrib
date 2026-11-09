import type { Column, SortDescriptor } from './DataTable';

/**
 * The pure sort/filter functions behind `createArrayDataSource` (see
 * `dataSource.ts`). They used to live inside `useTableSort`/
 * `useTableQuickFilter`, which transformed the table's `data` themselves;
 * the table now only ever asks a data source for rows, and the built-in
 * array source calls these. Kept in their own file, not in `dataSource.ts`,
 * so the `#toolcrib` barrel (which re-exports every export of a file that
 * carries a `@barrelExport` tag) doesn't publish them as public API.
 */

/**
 * Compares two resolved cell values the same way for every sort priority --
 * `null`/`undefined` and `NaN` both sort to the end regardless of
 * direction (an absent/invalid value has no meaningful position relative
 * to real ones), numbers compare numerically, everything else compares as
 * a case-insensitive string. Extracted as its own function so the
 * multi-column comparator can call it once per sort priority without
 * duplicating the null/NaN handling at each level. Exported so its own
 * anticommutativity property (`compare(a, b) === -compare(b, a)`, required
 * for `Array.prototype.sort` to behave predictably) can be tested
 * directly.
 */
export function compareValues(valA: unknown, valB: unknown, direction: 'asc' | 'desc'): number {
  if (valA === valB) return 0;
  // Real, confirmed bug caught by Gemini's review of #337: `null` and
  // `undefined` are both "nullish" (`== null` is true for either), but
  // `null === undefined` is false, so the two single-sided checks below
  // used to independently return 1 for BOTH `compareValues(null,
  // undefined, dir)` and `compareValues(undefined, null, dir)` -- an
  // anticommutative comparator violation (`compare(a, b)` must equal
  // `-compare(b, a)`), which Array.prototype.sort's spec explicitly
  // allows to produce unstable, engine-dependent ordering for. Checking
  // both-nullish first (treating `null` and `undefined` as equivalent
  // "absent" values, order-independent) closes the gap.
  if (valA == null && valB == null) return 0;
  if (valA == null) return 1;
  if (valB == null) return -1;
  if (typeof valA === 'number' && typeof valB === 'number') {
    if (Number.isNaN(valA) && Number.isNaN(valB)) return 0;
    if (Number.isNaN(valA)) return 1;
    if (Number.isNaN(valB)) return -1;
    return direction === 'asc' ? valA - valB : valB - valA;
  }
  const strA = String(valA).toLowerCase();
  const strB = String(valB).toLowerCase();
  if (strA < strB) return direction === 'asc' ? -1 : 1;
  if (strA > strB) return direction === 'asc' ? 1 : -1;
  return 0;
}

/**
 * `rows`, sorted by `sortBy` in priority order -- the same array
 * reference when `sortBy` is empty. A column with `accessorFn` sorts by
 * its computed value instead of a direct `record[key]` read. A sort
 * priority naming a column no longer present (e.g. controlled sortBy state
 * stale after a columns prop change) resolves to `undefined` for every
 * row, which `compareValues` treats as a tie and falls through to the next
 * priority, rather than throwing.
 */
export function sortRows<T extends Record<string, any>>(rows: T[], columns: Column<T>[], sortBy: SortDescriptor[]): T[] {
  if (sortBy.length === 0) return rows;
  const columnsByKey = new Map(columns.map(c => [c.key, c]));
  const getValue = (key: string, record: T): unknown => {
    const col = columnsByKey.get(key);
    return col?.accessorFn ? col.accessorFn(record) : col ? record[col.key] : undefined;
  };
  return [...rows].sort((a, b) => {
    for (const { key, direction } of sortBy) {
      const cmp = compareValues(getValue(key, a), getValue(key, b), direction);
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

/**
 * `rows`, filtered by a case-insensitive substring match of `text` against
 * every column's *resolved* value (`Column.accessorFn(record)` if given,
 * else `record[Column.key]`) -- deliberately not the rendered JSX a
 * `Column.render` might produce, since there's no general way to extract
 * plain text back out of arbitrary React output, and one resolved value
 * for both sorting and filtering keeps the two consistent. `fields`
 * restricts matching to just the named column keys (`undefined` searches
 * every column). The same array reference when `text` is blank.
 */
export function filterRows<T extends Record<string, any>>(
  rows: T[],
  columns: Column<T>[],
  fields: string[] | undefined,
  text: string
): T[] {
  const query = text.trim().toLowerCase();
  if (!query) return rows;
  let searchColumns = columns;
  if (fields) {
    const fieldSet = new Set(fields);
    searchColumns = columns.filter(col => fieldSet.has(col.key));
  }
  return rows.filter(record =>
    searchColumns.some(col => {
      const value = col.accessorFn ? col.accessorFn(record) : record[col.key];
      return String(value ?? '')
        .toLowerCase()
        .includes(query);
    })
  );
}
