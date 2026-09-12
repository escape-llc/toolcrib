'use client';

import { useMemo, useState } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import type { Column, SortDescriptor } from './DataTable';

export interface UseTableSortOptions<T extends Record<string, any>> {
  data: T[];
  columns: Column<T>[];
  /** Controlled multi-column sort, in priority order -- `undefined` means uncontrolled (internal state). */
  sortBy?: SortDescriptor[];
  defaultSortBy?: SortDescriptor[];
  onSortChange?: (sortBy: SortDescriptor[]) => void;
  /** This table instance's id, for the `datatable:sorted` event payload. */
  tableId: string;
}

export interface UseTableSortResult<T extends Record<string, any>> {
  sortBy: SortDescriptor[];
  /** `data`, sorted by `sortBy` in priority order -- unchanged (same reference) when `sortBy` is empty. */
  sortedData: T[];
  /**
   * A plain click (`shiftKey: false`) replaces the WHOLE sort with just
   * `key` -- the exact same asc -> desc -> unsorted cycle a single-sort
   * table always had, still true for the common case where `sortBy` never
   * grows past one entry. `shiftKey: true` instead adds/cycles/removes
   * `key` as the next sort PRIORITY without disturbing the others,
   * matching the Shift+click convention TanStack Table and AG Grid both
   * already use for their own multi-sort.
   */
  handleSort: (key: string, shiftKey: boolean) => void;
}

/**
 * Compares two resolved cell values the same way for every sort priority --
 * `null`/`undefined` and `NaN` both sort to the end regardless of
 * direction (an absent/invalid value has no meaningful position relative
 * to real ones), numbers compare numerically, everything else compares as
 * a case-insensitive string. Extracted as its own function (previously
 * inlined in the single-column comparator) so the multi-column comparator
 * below can call it once per sort priority without duplicating the
 * null/NaN handling at each level. Exported (not just used internally) so
 * its own anticommutativity property (`compare(a, b) === -compare(b, a)`,
 * required for `Array.prototype.sort` to behave predictably) can be
 * tested directly, the same way this repo's own `hsv.ts` property tests
 * verify a pure numeric function's real invariants rather than only its
 * behavior through whatever calls it.
 */
export function compareValues(valA: unknown, valB: unknown, direction: 'asc' | 'desc'): number {
  if (valA === valB) return 0;
  // Real, confirmed bug caught by Gemini's review of this PR (#337):
  // `null` and `undefined` are both "nullish" (`== null` is true for
  // either), but `null === undefined` is false, so the two branches below
  // used to independently return 1 for BOTH `compareValues(null,
  // undefined, dir)` and `compareValues(undefined, null, dir)` -- an
  // anticommutative comparator violation (`compare(a, b)` must equal
  // `-compare(b, a)`), which Array.prototype.sort's spec explicitly
  // allows to produce unstable, engine-dependent ordering for. Checking
  // both-nullish first (treating `null` and `undefined` as equivalent
  // "absent" values, order-independent) closes the gap the two
  // single-sided checks below left open.
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
 * Extracted from `DataTable`'s own inline implementation (see issue #322),
 * generalized from a single `sortKey`/`sortDirection` pair to a
 * `SortDescriptor[]` priority list (see issue #337) -- a real API shape
 * change, not a backward-compatible addition, per this repo's own
 * "no shims for vendored source" policy (AGENTS.md): the old single-value
 * shape is gone, not kept alongside the new one.
 */
export function useTableSort<T extends Record<string, any>>({
  data,
  columns,
  sortBy: controlledSortBy,
  defaultSortBy,
  onSortChange,
  tableId,
}: UseTableSortOptions<T>): UseTableSortResult<T> {
  const [internalSortBy, setInternalSortBy] = useState<SortDescriptor[]>(defaultSortBy ?? []);
  const isSortControlled = controlledSortBy !== undefined;
  const sortBy = isSortControlled ? controlledSortBy : internalSortBy;

  const sortedData = useMemo(() => {
    if (sortBy.length === 0) return data;
    const columnsByKey = new Map(columns.map(c => [c.key, c]));
    // A column with `accessorFn` sorts by its computed value instead of a
    // direct `record[key]` read — the same function that produces its
    // cell value. A sort priority naming a column no longer present (e.g.
    // controlled sortBy state stale after a columns prop change) resolves
    // to `undefined` for every row, which compareValues treats as a tie
    // and falls through to the next priority, rather than throwing.
    const getValue = (key: string, record: T): unknown => {
      const col = columnsByKey.get(key);
      return col?.accessorFn ? col.accessorFn(record) : col ? record[col.key] : undefined;
    };
    return [...data].sort((a, b) => {
      for (const { key, direction } of sortBy) {
        const cmp = compareValues(getValue(key, a), getValue(key, b), direction);
        if (cmp !== 0) return cmp;
      }
      return 0;
    });
  }, [data, sortBy, columns]);

  const handleSort = (key: string, shiftKey: boolean) => {
    let newSortBy: SortDescriptor[];
    if (!shiftKey) {
      // Plain click: behaves exactly like a single-sort table always did
      // when `key` is already the SOLE sort (cycle asc -> desc ->
      // unsorted); otherwise replaces the whole sort with a fresh
      // ascending sort on just this column, clearing any others.
      const isSoleSort = sortBy.length === 1 && sortBy[0].key === key;
      if (isSoleSort) {
        newSortBy = sortBy[0].direction === 'asc' ? [{ key, direction: 'desc' }] : [];
      } else {
        newSortBy = [{ key, direction: 'asc' }];
      }
    } else {
      // Shift+click: adds `key` as the next sort priority, cycles its
      // direction in place if it's already part of the sort, or drops it
      // entirely (cycling back to unsorted for just this column) once it
      // was already descending -- every OTHER priority stays untouched.
      const existingIndex = sortBy.findIndex(d => d.key === key);
      if (existingIndex === -1) {
        newSortBy = [...sortBy, { key, direction: 'asc' }];
      } else if (sortBy[existingIndex].direction === 'asc') {
        newSortBy = sortBy.map((d, i) => (i === existingIndex ? { key, direction: 'desc' as const } : d));
      } else {
        newSortBy = sortBy.filter((_, i) => i !== existingIndex);
      }
    }
    if (!isSortControlled) setInternalSortBy(newSortBy);
    onSortChange?.(newSortBy);
    aiBus.emit('datatable:sorted', { id: tableId, sortBy: newSortBy });
  };

  return { sortBy, sortedData, handleSort };
}
