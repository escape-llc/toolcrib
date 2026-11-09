'use client';

import { useState } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import type { SortDescriptor } from './DataTable';

// The comparator moved to tableQuery.ts with the rest of the pure sort/
// filter logic; re-exported so existing imports from here keep resolving.
export { compareValues } from './tableQuery';

export interface UseTableSortOptions {
  /** Controlled multi-column sort, in priority order -- `undefined` means uncontrolled (internal state). */
  sortBy?: SortDescriptor[];
  defaultSortBy?: SortDescriptor[];
  onSortChange?: (sortBy: SortDescriptor[]) => void;
  /** This table instance's id, for the `datatable:sorted` event payload. */
  tableId: string;
}

export interface UseTableSortResult {
  sortBy: SortDescriptor[];
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
 * The sort STATE for `<DataTable>` (issue #322, generalized from a single
 * `sortKey`/`sortDirection` pair to a `SortDescriptor[]` priority list in
 * issue #337 -- a real API shape change, not a backward-compatible
 * addition, per this repo's own "no shims for vendored source" policy
 * (AGENTS.md)). Owns the controlled/uncontrolled value, the click-cycling
 * rules and the `datatable:sorted` event. It does not sort anything: the
 * table asks its data source for rows in this order (`sortRows` in
 * `tableQuery.ts` is what the array source calls).
 */
export function useTableSort({
  sortBy: controlledSortBy,
  defaultSortBy,
  onSortChange,
  tableId,
}: UseTableSortOptions): UseTableSortResult {
  const [internalSortBy, setInternalSortBy] = useState<SortDescriptor[]>(defaultSortBy ?? []);
  const isSortControlled = controlledSortBy !== undefined;
  const sortBy = isSortControlled ? controlledSortBy : internalSortBy;

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

  return { sortBy, handleSort };
}
