'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { aiBus } from '../../eventBus/eventBus';

export interface UseTableSelectionOptions<T> {
  /** Whether the selection column/behavior is active at all. */
  selectable: boolean;
  /** `'single'` behaves like a radio group -- any selection action replaces the whole set with just that one row, and modifier keys are ignored (a real radio can't be Ctrl/Shift-clicked into a multi-selection either). @default 'multiple' */
  selectionMode: 'single' | 'multiple';
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
  /**
   * The checkbox/radio's own toggle -- always an additive/subtractive
   * flip of just this one row in `'multiple'` mode (regardless of how a
   * row-level click might behave), or a full replace in `'single'` mode.
   * `index` (page-relative, matching `currentPageRecords`) is optional
   * only for a caller with no natural index on hand; passing it keeps the
   * Shift-click range anchor in sync with whichever row was last acted on
   * by ANY means (checkbox, plain click, Ctrl-click), matching a real
   * spreadsheet/file-manager's own anchor behavior.
   */
  toggleRowSelected: (key: string, index?: number) => void;
  toggleSelectAllOnPage: () => void;
  /**
   * Resolves a row CLICK's full modifier-aware behavior -- plain click
   * replaces the selection with just this row, Ctrl/Cmd-click toggles just
   * this row (same as the checkbox), Shift-click range-selects from the
   * last acted-on row to this one (current page only -- see this file's
   * own header comment for why range-select doesn't cross pages). Ignores
   * modifiers entirely in `'single'` mode, where every click just selects
   * that one row.
   */
  handleRowSelectClick: (key: string, index: number, modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => void;
  /** True once every row on the current page is selected. Always false in `'single'` mode (a "select all" control makes no sense for a single choice). */
  allOnPageSelected: boolean;
  /** True when some, but not all, rows on the current page are selected. Always false in `'single'` mode. */
  someOnPageSelected: boolean;
}

/**
 * Extracted from `DataTable`'s own inline implementation (see issue #322) --
 * owns the controlled/uncontrolled selected-keys state (a `Set`, persisting
 * across pages by design), the current-page-scoped 3-state header-checkbox
 * logic, and the `datatable:selection_changed` emission.
 *
 * Click-to-select (`handleRowSelectClick`) and `selectionMode: 'single'`
 * were added afterward (see issue #329) -- `<DataTable>` previously only
 * supported checkbox-driven multi-select, with row clicks handled
 * entirely by the separate, unrelated `onRowClick` prop. Modifier
 * semantics (plain replace / Ctrl toggle / Shift range) match the
 * conventional desktop file-manager/spreadsheet model AG Grid and MUI X
 * DataGrid both also use for their own default row-click selection.
 */
export function useTableSelection<T>({
  selectable,
  selectionMode,
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

  // The Shift-click range anchor -- the page-relative index of the last row
  // any selection action (checkbox, plain click, Ctrl-click) touched. A
  // plain ref, not state: updating it should never itself trigger a
  // re-render, only change what a FUTURE Shift-click computes.
  const lastActedIndexRef = useRef<number | null>(null);

  const toggleRowSelected = (key: string, index?: number) => {
    if (index !== undefined) lastActedIndexRef.current = index;
    if (selectionMode === 'single') {
      updateSelection(new Set([key]));
      return;
    }
    const next = new Set(selectedKeySet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    updateSelection(next);
  };

  const handleRowSelectClick = (
    key: string,
    index: number,
    modifiers: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }
  ) => {
    if (selectionMode === 'single') {
      updateSelection(new Set([key]));
      lastActedIndexRef.current = index;
      return;
    }
    if (modifiers.shiftKey && lastActedIndexRef.current !== null) {
      // Range-select is scoped to the CURRENT PAGE only, matching
      // useTableKeyboardNav's own established "navigation doesn't cross a
      // page boundary" convention -- a cross-page range has no single
      // correct interpretation once sorting/filtering is involved, and
      // every other index this component hands out (rowSubtheme, keyboard
      // nav, Column.render) already carries the same page-relative
      // contract.
      const [start, end] = [lastActedIndexRef.current, index].sort((a, b) => a - b);
      const rangeKeys = currentPageRecords.slice(start, end + 1).map((record, i) => getSelectionKey(record, start + i));
      updateSelection(new Set(rangeKeys));
      // Deliberately does NOT move the anchor -- a second Shift-click
      // should extend/shrink the SAME range from the original anchor, not
      // re-anchor from wherever the previous Shift-click landed (matching
      // a real spreadsheet/file-manager's own Shift-click behavior).
      return;
    }
    if (modifiers.ctrlKey || modifiers.metaKey) {
      toggleRowSelected(key, index);
      return;
    }
    updateSelection(new Set([key]));
    lastActedIndexRef.current = index;
  };

  // Scoped to the *current page* only -- "some but not all of the current
  // page selected" -- even though `selectedKeySet` itself holds keys from
  // any page (selection persists across pages).
  const currentPageKeys = useMemo(
    () => (selectable ? currentPageRecords.map((record, i) => getSelectionKey(record, i)) : []),
    [selectable, currentPageRecords, getSelectionKey]
  );
  // "Select all" has no meaning for a single-choice model -- always false
  // in 'single' mode so DataTable's header control stays hidden/inert
  // rather than needing its own separate selectionMode check.
  const isMultiple = selectionMode !== 'single';
  const allOnPageSelected =
    isMultiple && selectable && currentPageKeys.length > 0 && currentPageKeys.every(k => selectedKeySet.has(k));
  const someOnPageSelected = isMultiple && selectable && !allOnPageSelected && currentPageKeys.some(k => selectedKeySet.has(k));

  const toggleSelectAllOnPage = () => {
    const next = new Set(selectedKeySet);
    if (allOnPageSelected) currentPageKeys.forEach(k => next.delete(k));
    else currentPageKeys.forEach(k => next.add(k));
    updateSelection(next);
  };

  return {
    selectedKeySet,
    getSelectionKey,
    toggleRowSelected,
    toggleSelectAllOnPage,
    handleRowSelectClick,
    allOnPageSelected,
    someOnPageSelected,
  };
}
