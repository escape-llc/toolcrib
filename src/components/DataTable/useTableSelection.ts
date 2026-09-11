'use client';

import { useCallback, useMemo, useState } from 'react';
import { aiBus } from '../../eventBus/eventBus';

export interface UseTableSelectionOptions<T> {
  /** Whether the selection column/behavior is active at all. */
  selectable: boolean;
  /** Controlled set of selected row keys -- `undefined` means uncontrolled (internal state). */
  selectedKeys?: string[];
  defaultSelectedKeys?: string[];
  onSelectionChange?: (selectedKeys: string[]) => void;
  /** This table instance's id, for the `datatable:selection_changed` event payload. */
  tableId: string;
  rowKey?: (record: T, index: number) => string | number;
  /**
   * The current page's starting offset into the full sorted dataset (0 when
   * pagination is disabled, since `currentPageRecords` is already the full
   * dataset in that case) -- used only for the index-based selection-key
   * fallback below, entirely separate from `rowKey`'s own page-relative
   * index contract used elsewhere in `DataTable`.
   */
  pageOffset: number;
  /** The records actually visible on the current page (post-sort, post-pagination-slice). */
  currentPageRecords: T[];
}

export interface UseTableSelectionResult<T> {
  selectedKeySet: Set<string>;
  getSelectionKey: (record: T, pageRelativeIndex: number) => string;
  toggleRowSelected: (key: string) => void;
  toggleSelectAllOnPage: () => void;
  /** True once every row on the current page is selected. */
  allOnPageSelected: boolean;
  /** True when some, but not all, rows on the current page are selected. */
  someOnPageSelected: boolean;
}

/**
 * Extracted from `DataTable`'s own inline implementation (see issue #322) --
 * owns the controlled/uncontrolled selected-keys state (a `Set`, persisting
 * across pages by design), the current-page-scoped 3-state header-checkbox
 * logic, and the `datatable:selection_changed` emission. No public API or
 * behavior change; this is purely an internal-architecture split.
 */
export function useTableSelection<T>({
  selectable,
  selectedKeys: controlledSelectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  tableId,
  rowKey,
  pageOffset,
  currentPageRecords,
}: UseTableSelectionOptions<T>): UseTableSelectionResult<T> {
  // Wrapped in useCallback (not a plain closure) so it's referentially
  // stable across renders unless rowKey/pageOffset actually change -- lets
  // currentPageKeys's own useMemo below list it as a real dependency
  // instead of needing an eslint-disable to manually track its transitive
  // deps (rowKey/pageOffset) by hand.
  const getSelectionKey = useCallback(
    (record: T, pageRelativeIndex: number): string =>
      rowKey ? String(rowKey(record, pageRelativeIndex)) : String(pageOffset + pageRelativeIndex),
    [rowKey, pageOffset]
  );

  const [internalSelectedKeys, setInternalSelectedKeys] = useState<Set<string>>(
    () => new Set(defaultSelectedKeys ?? [])
  );
  const isSelectionControlled = controlledSelectedKeys !== undefined;
  const selectedKeySet = isSelectionControlled ? new Set(controlledSelectedKeys) : internalSelectedKeys;

  const updateSelection = (next: Set<string>) => {
    if (!isSelectionControlled) setInternalSelectedKeys(next);
    const arr = Array.from(next);
    onSelectionChange?.(arr);
    aiBus.emit('datatable:selection_changed', { id: tableId, selectedKeys: arr });
  };

  const toggleRowSelected = (key: string) => {
    const next = new Set(selectedKeySet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    updateSelection(next);
  };

  // Scoped to the *current page* only -- "some but not all of the current
  // page selected" -- even though `selectedKeySet` itself holds keys from
  // any page (selection persists across pages).
  const currentPageKeys = useMemo(
    () => (selectable ? currentPageRecords.map((record, i) => getSelectionKey(record, i)) : []),
    [selectable, currentPageRecords, getSelectionKey]
  );
  const allOnPageSelected = selectable && currentPageKeys.length > 0 && currentPageKeys.every(k => selectedKeySet.has(k));
  const someOnPageSelected = selectable && !allOnPageSelected && currentPageKeys.some(k => selectedKeySet.has(k));

  const toggleSelectAllOnPage = () => {
    const next = new Set(selectedKeySet);
    if (allOnPageSelected) currentPageKeys.forEach(k => next.delete(k));
    else currentPageKeys.forEach(k => next.add(k));
    updateSelection(next);
  };

  return { selectedKeySet, getSelectionKey, toggleRowSelected, toggleSelectAllOnPage, allOnPageSelected, someOnPageSelected };
}
