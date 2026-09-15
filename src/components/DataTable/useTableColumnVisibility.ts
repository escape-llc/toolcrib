'use client';

import { useState } from 'react';
import { aiBus } from '../../eventBus/eventBus';

export interface UseTableColumnVisibilityOptions {
  /** Controlled set of hidden column keys (`Column.key`). `undefined` means uncontrolled (internal state). */
  hiddenColumns?: string[];
  defaultHiddenColumns?: string[];
  onHiddenColumnsChange?: (hiddenColumns: string[]) => void;
  /** This table instance's id, for the `datatable:columns_changed` event payload. */
  tableId: string;
}

export interface UseTableColumnVisibilityResult {
  /** `Column.key`s currently hidden, as a `Set` for O(1) membership checks against every column on every render. */
  hiddenColumnSet: Set<string>;
  /** Flips one column's hidden/visible state. */
  toggleColumnVisibility: (key: string) => void;
}

/**
 * `<DataTable columnVisibility>`'s own show/hide state (issue #340) -- same
 * controlled/uncontrolled shape `useTableDensity`/`useTableSort` already
 * use. Deliberately keyed by `Column.key` in a plain string array (not an
 * index), matching `columnWidths`'/`sortBy`'s own key-based addressing --
 * stable across a `columns` prop reorder, unlike a positional index would
 * be.
 */
export function useTableColumnVisibility({
  hiddenColumns: controlledHiddenColumns,
  defaultHiddenColumns,
  onHiddenColumnsChange,
  tableId,
}: UseTableColumnVisibilityOptions): UseTableColumnVisibilityResult {
  const [internalHiddenColumns, setInternalHiddenColumns] = useState<string[]>(defaultHiddenColumns ?? []);
  const isControlled = controlledHiddenColumns !== undefined;
  const hiddenColumns = isControlled ? controlledHiddenColumns! : internalHiddenColumns;
  const hiddenColumnSet = new Set(hiddenColumns);

  const toggleColumnVisibility = (key: string) => {
    const next = hiddenColumnSet.has(key) ? hiddenColumns.filter(k => k !== key) : [...hiddenColumns, key];
    if (!isControlled) setInternalHiddenColumns(next);
    onHiddenColumnsChange?.(next);
    aiBus.emit('datatable:columns_changed', { id: tableId, hiddenColumns: next });
  };

  return { hiddenColumnSet, toggleColumnVisibility };
}
