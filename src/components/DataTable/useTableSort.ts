'use client';

import { useMemo, useState } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import type { Column } from './DataTable';

export interface UseTableSortOptions<T> {
  data: T[];
  columns: Column<T>[];
  /** Controlled sort key -- `undefined` means uncontrolled (internal state). */
  sortKey?: string | null;
  defaultSortKey?: string | null;
  sortDirection?: 'asc' | 'desc';
  defaultSortDirection?: 'asc' | 'desc';
  onSortChange?: (key: string | null, direction: 'asc' | 'desc') => void;
  /** This table instance's id, for the `datatable:sorted` event payload. */
  tableId: string;
}

export interface UseTableSortResult<T> {
  sortKey: string | null;
  sortDirection: 'asc' | 'desc';
  /** `data`, sorted by `sortKey`/`sortDirection` -- unchanged (same reference) when unsorted. */
  sortedData: T[];
  /** Cycles asc -> desc -> unsorted for `key`, same as clicking a sortable header. */
  handleSort: (key: string) => void;
}

/**
 * Extracted from `DataTable`'s own inline implementation (see issue #322) --
 * owns the controlled/uncontrolled sort-key/direction state, the asc/desc/
 * unsorted cycle, and the actual `data` sort (including the NaN-to-end and
 * accessorFn-aware comparator DataTable's tests already cover). No public
 * API or behavior change; this is purely an internal-architecture split.
 */
export function useTableSort<T>({
  data,
  columns,
  sortKey: controlledSortKey,
  defaultSortKey,
  sortDirection: controlledSortDirection,
  defaultSortDirection,
  onSortChange,
  tableId,
}: UseTableSortOptions<T>): UseTableSortResult<T> {
  // Same controlled/uncontrolled split as TabStrip's activeId: a prop of
  // `undefined` means "manage it internally" (seeded from the matching
  // `default*` prop), anything else means the parent owns that state and
  // this hook only ever reads it back through the resolved `sortKey` below.
  const [internalSortKey, setInternalSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [internalSortDirection, setInternalSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection ?? 'asc');
  const isSortControlled = controlledSortKey !== undefined;
  const sortKey = isSortControlled ? controlledSortKey : internalSortKey;
  const sortDirection = isSortControlled ? controlledSortDirection ?? 'asc' : internalSortDirection;

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    // A column with `accessorFn` sorts by its computed value instead of a
    // direct `record[sortKey]` read — the same function that produces its
    // cell value.
    const sortColumn = columns.find(c => c.key === sortKey);
    const getValue = (record: T): unknown => (sortColumn?.accessorFn ? sortColumn.accessorFn(record) : (record as any)[sortKey]);
    return [...data].sort((a, b) => {
      const valA = getValue(a);
      const valB = getValue(b);
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        // A NaN operand makes `valA - valB` itself NaN, which
        // Array.prototype.sort treats as an unspecified (non-crashing but
        // effectively unsorted) comparison result — sort NaN to the end,
        // the same place `null`/`undefined` land above, rather than
        // leaving its position undefined.
        if (Number.isNaN(valA) && Number.isNaN(valB)) return 0;
        if (Number.isNaN(valA)) return 1;
        if (Number.isNaN(valB)) return -1;
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDirection, columns]);

  const handleSort = (key: string) => {
    let newKey: string | null;
    let newDirection: 'asc' | 'desc';
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        newKey = key;
        newDirection = 'desc';
      } else {
        newKey = null;
        newDirection = sortDirection;
      }
    } else {
      newKey = key;
      newDirection = 'asc';
    }
    if (!isSortControlled) {
      setInternalSortKey(newKey);
      setInternalSortDirection(newDirection);
    }
    onSortChange?.(newKey, newDirection);
    aiBus.emit('datatable:sorted', { id: tableId, key: newKey, direction: newDirection });
  };

  return { sortKey, sortDirection, sortedData, handleSort };
}
