'use client';

import { useMemo, useState } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import type { Column } from './DataTable';

export interface UseTableQuickFilterOptions<T extends Record<string, any>> {
  data: T[];
  columns: Column<T>[];
  /** Controlled quick-filter value -- `undefined` means uncontrolled (internal state). */
  quickFilterValue?: string;
  defaultQuickFilterValue?: string;
  onQuickFilterChange?: (value: string) => void;
  /** This table instance's id, for the `datatable:filtered` event payload. */
  tableId: string;
  /** Column keys to restrict matching to -- `undefined` (the default) searches every column, matching the previous, only behavior. */
  quickFilterFields?: string[];
}

export interface UseTableQuickFilterResult<T extends Record<string, any>> {
  quickFilterValue: string;
  /** `data`, filtered by `quickFilterValue` -- unchanged (same reference) when the filter is empty, matching `useTableSort`'s own "unchanged when unsorted" convention for the identical referential-stability reason. */
  filteredData: T[];
  /** Updates the filter value, whether controlled or uncontrolled, and emits `datatable:filtered`. */
  handleQuickFilterChange: (value: string) => void;
}

/**
 * `<DataTable quickFilter>`'s own global/quick-search implementation (issue
 * #317) -- a simple case-insensitive substring match against every column's
 * *resolved* value (`Column.accessorFn(record)` if given, else
 * `record[Column.key]`), matching the same value `useTableSort` itself
 * sorts by. Deliberately NOT the rendered JSX a `Column.render` might
 * produce -- there is no general, reliable way to extract plain text back
 * out of arbitrary React output, and re-deriving one value for both
 * sorting and filtering keeps the two mechanisms consistent with each
 * other (a column already sorts by its resolved value today; filtering by
 * anything else would mean the two disagree about what a column's own
 * "content" even is).
 */
export function useTableQuickFilter<T extends Record<string, any>>({
  data,
  columns,
  quickFilterValue: controlledValue,
  defaultQuickFilterValue,
  onQuickFilterChange,
  tableId,
  quickFilterFields,
}: UseTableQuickFilterOptions<T>): UseTableQuickFilterResult<T> {
  const [internalValue, setInternalValue] = useState<string>(defaultQuickFilterValue ?? '');
  const isControlled = controlledValue !== undefined;
  const quickFilterValue = isControlled ? controlledValue! : internalValue;

  // Restricts matching to just the named columns when given (issue #372) --
  // `undefined`/omitted keeps searching every column, the only behavior
  // before this. A `Set` for O(1) membership checks, since this can run
  // once per row per keystroke.
  //
  // The memo's own dependency is `quickFilterFields`'s SERIALIZED form
  // (`.join(',')`), not the array reference itself -- a real,
  // Gemini-caught defect: a consumer passing an inline array literal
  // (`quickFilterFields={['name', 'email']}`, an entirely normal way to
  // pass this prop) gets a new array reference every render, which would
  // otherwise recompute this memo -- and everything downstream of it,
  // including `filteredData` -- on every single render regardless of
  // whether the actual field list changed at all. Matches this file's own
  // sibling `resetKey` precedent in DataTable.tsx (`sortBy.map(...).join
  // (',')`) for the identical reason.
  const quickFilterFieldsKey = quickFilterFields?.join(',');
  const searchColumns = useMemo(() => {
    if (!quickFilterFields) return columns;
    const fieldSet = new Set(quickFilterFields);
    return columns.filter(col => fieldSet.has(col.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- quickFilterFieldsKey stands in for quickFilterFields itself, see this memo's own comment above.
  }, [columns, quickFilterFieldsKey]);

  const filteredData = useMemo(() => {
    const query = quickFilterValue.trim().toLowerCase();
    if (!query) return data;
    return data.filter(record =>
      searchColumns.some(col => {
        const value = col.accessorFn ? col.accessorFn(record) : record[col.key];
        return String(value ?? '')
          .toLowerCase()
          .includes(query);
      })
    );
  }, [data, searchColumns, quickFilterValue]);

  const handleQuickFilterChange = (value: string) => {
    if (!isControlled) setInternalValue(value);
    onQuickFilterChange?.(value);
    // Recomputed directly here (not read back from `filteredData` above) --
    // this fires from the input's own onChange, in the same tick `value`
    // changes but before this render's `filteredData` memo has necessarily
    // recomputed against it, so the emitted matchCount could otherwise lag
    // one keystroke behind the value it's reported alongside.
    const query = value.trim().toLowerCase();
    const matchCount = !query
      ? data.length
      : data.filter(record =>
          searchColumns.some(col => {
            const v = col.accessorFn ? col.accessorFn(record) : record[col.key];
            return String(v ?? '')
              .toLowerCase()
              .includes(query);
          })
        ).length;
    aiBus.emit('datatable:filtered', { id: tableId, value, matchCount });
  };

  return { quickFilterValue, filteredData, handleQuickFilterChange };
}
