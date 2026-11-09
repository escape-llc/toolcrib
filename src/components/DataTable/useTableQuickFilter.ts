'use client';

import { useMemo, useState } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import type { Column } from './DataTable';
import { filterRows } from './tableQuery';

export interface UseTableQuickFilterOptions<T extends Record<string, any>> {
  /**
   * Optional rows to filter into `filteredData` (and to count matches in
   * for `datatable:filtered` when `getMatchCount` isn't given). `<DataTable>`
   * itself doesn't pass this -- the table asks its data source for already-
   * filtered rows -- it's here for callers using this hook standalone.
   */
  data?: T[];
  columns: Column<T>[];
  /** Controlled quick-filter value -- `undefined` means uncontrolled (internal state). */
  quickFilterValue?: string;
  defaultQuickFilterValue?: string;
  onQuickFilterChange?: (value: string) => void;
  /** This table instance's id, for the `datatable:filtered` event payload. */
  tableId: string;
  /** Column keys to restrict matching to -- `undefined` (the default) searches every column, matching the previous, only behavior. */
  quickFilterFields?: string[];
  /** Resolves the `matchCount` that `datatable:filtered` reports for a new value. Defaults to counting matches in `data`. */
  getMatchCount?: (value: string) => number;
}

export interface UseTableQuickFilterResult<T extends Record<string, any>> {
  quickFilterValue: string;
  /** `data`, filtered by `quickFilterValue` -- unchanged (same reference) when the filter is empty, matching `useTableSort`'s own "unchanged when unsorted" convention for the identical referential-stability reason. Empty when no `data` was given. */
  filteredData: T[];
  /** Updates the filter value, whether controlled or uncontrolled, and emits `datatable:filtered`. */
  handleQuickFilterChange: (value: string) => void;
}

const NO_DATA: never[] = [];

/**
 * `<DataTable quickFilter>`'s own global/quick-search state (issue #317):
 * the controlled/uncontrolled value, `onQuickFilterChange`, and the
 * `datatable:filtered` event. The matching itself (a case-insensitive
 * substring match against every column's *resolved* value) is
 * `filterRows` in `tableQuery.ts`, called by the array data source.
 */
export function useTableQuickFilter<T extends Record<string, any>>({
  data,
  columns,
  quickFilterValue: controlledValue,
  defaultQuickFilterValue,
  onQuickFilterChange,
  tableId,
  quickFilterFields,
  getMatchCount,
}: UseTableQuickFilterOptions<T>): UseTableQuickFilterResult<T> {
  const [internalValue, setInternalValue] = useState<string>(defaultQuickFilterValue ?? '');
  const isControlled = controlledValue !== undefined;
  const quickFilterValue = isControlled ? controlledValue! : internalValue;

  // The memo's own dependency is `quickFilterFields`'s SERIALIZED form
  // (`.join(',')`), not the array reference itself -- a real,
  // Gemini-caught defect: a consumer passing an inline array literal
  // (`quickFilterFields={['name', 'email']}`, an entirely normal way to
  // pass this prop) gets a new array reference every render, which would
  // otherwise recompute this memo on every single render regardless of
  // whether the actual field list changed at all. Matches this file's own
  // sibling `resetKey` precedent in DataTable.tsx (`sortBy.map(...).join
  // (',')`) for the identical reason.
  const quickFilterFieldsKey = quickFilterFields?.join(',');
  const filteredData = useMemo(
    () => (data ? filterRows(data, columns, quickFilterFields, quickFilterValue) : NO_DATA),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- quickFilterFieldsKey stands in for quickFilterFields itself, see the comment above.
    [data, columns, quickFilterFieldsKey, quickFilterValue]
  );

  const handleQuickFilterChange = (value: string) => {
    if (!isControlled) setInternalValue(value);
    onQuickFilterChange?.(value);
    // Computed directly here (not read back from `filteredData` above) --
    // this fires from the input's own onChange, in the same tick `value`
    // changes but before this render's `filteredData` memo has necessarily
    // recomputed against it, so the emitted matchCount could otherwise lag
    // one keystroke behind the value it's reported alongside.
    const matchCount = getMatchCount
      ? getMatchCount(value)
      : data
        ? filterRows(data, columns, quickFilterFields, value).length
        : 0;
    aiBus.emit('datatable:filtered', { id: tableId, value, matchCount });
  };

  return { quickFilterValue, filteredData, handleQuickFilterChange };
}
