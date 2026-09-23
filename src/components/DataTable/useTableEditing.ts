'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import { isDevBuild } from '../../theme/safeProps';

export interface UseTableEditingOptions<T> {
  /** Whether row-edit mode is active at all -- mirrors `selectable`'s own greenfield gate. */
  editable: boolean;
  /** Controlled set of editing row keys -- `undefined` means uncontrolled (internal state). */
  editingKeys?: string[];
  defaultEditingKeys?: string[];
  onEditingKeysChange?: (editingKeys: string[]) => void;
  /** This table instance's id, for the `datatable:row_edit_*` event payloads. */
  tableId: string;
  /**
   * Required whenever `editable` is true (enforced by `DataTable`'s own
   * discriminated prop type and a runtime throw before this hook is ever
   * called) -- unlike selection's `rowKey`, there is no index-fallback
   * here, since the co-grid must resolve the SAME record from a
   * completely different sort/filter/page view than the one a row was
   * clicked from. That only works if `rowKey`'s result depends solely on
   * `record`, never on `index` -- a `rowKey` that varies by index (the
   * exact shape of function the index-fallback itself represents) breaks
   * cross-page/cross-sort identity the same way omitting `rowKey`
   * entirely would. The `index` parameter is still accepted (matching
   * every other `rowKey` call site's own signature), just expected to be
   * ignored by a real implementation.
   */
  rowKey?: (record: T, index: number) => string | number;
  /**
   * The raw, unsorted/unfiltered/unpaginated data array -- the editing
   * key-set and `recordByEditKey` resolve records against THIS array, not
   * any page/sort/filter-derived view, which is what lets a co-grid row
   * survive navigating away from the page/sort/filter it was started
   * from. `index` handed to `rowKey` here is each record's position in
   * THIS array (documented as such on `CellContext`'s own `index` field
   * for a co-grid row, distinct from the main grid's page-relative
   * convention for the same field) -- harmless under the index-independence
   * requirement above, and a reasonable, stable choice when it isn't.
   */
  data: T[];
  /** The records actually visible on the current page (post-sort/filter/pagination) -- used only for the pairing-highlight intersection below. */
  currentPageRecords: T[];
  /**
   * Hard ceiling on how many rows the edit co-grid will ever actually
   * render at once (issue #545's own "abuse" concern -- the co-grid is
   * deliberately unvirtualized, so nothing else bounds it). Enforced two
   * ways: `startEditingRow`/`startEditingRows` refuse to grow the set past
   * this once reached, AND -- since a `editingKeys` CONTROLLED prop can
   * set an arbitrarily large array directly, bypassing those two functions
   * entirely -- `cappedEditingKeys` below is a render-safe, truncated view
   * that's the one thing `DataTable.tsx` actually builds co-grid rows
   * from, regardless of how large the real `editingKeySet` got.
   */
  maxEditingRows: number;
}

export interface UseTableEditingResult<T> {
  editingKeySet: Set<string>;
  /**
   * The subset of `editingKeySet` (at most `maxEditingRows` of them) it's
   * actually safe to render co-grid rows for -- see `maxEditingRows`'s own
   * doc. Equal to `editingKeySet` in the overwhelmingly common case where
   * the real set never gets that large; only differs when a controlled
   * `editingKeys` prop set more than the cap directly.
   */
  cappedEditingKeys: string[];
  /** How many keys `cappedEditingKeys` had to leave out. Zero in the common case. */
  truncatedEditingCount: number;
  /** Every editing key whose record is ALSO part of the main grid's current page/sort/filter view -- drives the pairing highlight between a co-grid row and its main-grid placeholder. */
  currentPageEditingKeys: Set<string>;
  /** Resolves an editing key back to its full record + raw-`data` index -- the co-grid's own row source, and how every action below resolves `index` for its emitted event. */
  recordByEditKey: Map<string, { record: T; index: number }>;
  getEditingKey: (record: T, index: number) => string;
  /** Adds one row to the editing set. No-ops (with no emission) if the key is already present -- re-starting an already-editing row isn't a real transition. */
  startEditingRow: (key: string) => void;
  /** Batch-add -- e.g. `renderBulkActions`'s "edit selected" case. Adds every key not already present, one `datatable:row_edit_started` per newly-added key, one combined `onEditingKeysChange` call. */
  startEditingRows: (keys: string[]) => void;
  /** Removes a row from the editing set without persisting anything -- the co-grid row's Cancel action. */
  cancelEditingRow: (key: string) => void;
  /** Removes a row from the editing set and emits `datatable:row_edit_saved` with the schema-parsed `values` -- the co-grid row's Save action, called from `Form`'s own `onSubmit`. */
  saveEditingRow: (key: string, values: T) => void;
}

/**
 * Owns the controlled/uncontrolled editing-keys state for `<DataTable
 * editable>` (issue #545) -- mirrors `useTableSelection.ts`'s own
 * controlled/uncontrolled `Set<string>` pattern, but deliberately does
 * NOT share its index-fallback key resolution: `editable` requires a
 * real, index-independent `rowKey`, so `getEditingKey` here is simply
 * `String(rowKey(record, index))`, with no fallback branch to share.
 *
 * `recordByEditKey` (built from the raw `data` prop, not any page/sort/
 * filter-derived array) is what makes the edit co-grid structurally
 * decoupled from sort/filter/pagination -- it's the co-grid's only route
 * back to a record, and it never changes shape just because the main
 * grid's own view of `data` did.
 */
export function useTableEditing<T>({
  editable,
  editingKeys: controlledEditingKeys,
  defaultEditingKeys,
  onEditingKeysChange,
  tableId,
  rowKey,
  data,
  currentPageRecords,
  maxEditingRows,
}: UseTableEditingOptions<T>): UseTableEditingResult<T> {
  const getEditingKey = useCallback(
    (record: T, index: number): string => String(rowKey ? rowKey(record, index) : index),
    [rowKey]
  );

  const recordByEditKey = useMemo(() => {
    const map = new Map<string, { record: T; index: number }>();
    if (!editable) return map;
    data.forEach((record, index) => {
      map.set(getEditingKey(record, index), { record, index });
    });
    return map;
  }, [editable, data, getEditingKey]);

  const [internalEditingKeys, setInternalEditingKeys] = useState<Set<string>>(
    () => new Set(defaultEditingKeys ?? [])
  );
  const isEditingControlled = controlledEditingKeys !== undefined;
  // Memoized (unlike a plain `new Set(...)` per render) specifically
  // because `currentPageEditingKeys` below depends on this value -- an
  // unmemoized fresh Set every render would defeat that useMemo entirely
  // (confirmed by a real `react-hooks/exhaustive-deps` warning during
  // development, not just theoretical waste).
  const controlledEditingKeySet = useMemo(() => new Set(controlledEditingKeys ?? []), [controlledEditingKeys]);
  const editingKeySet = isEditingControlled ? controlledEditingKeySet : internalEditingKeys;

  const commitEditingKeys = (next: Set<string>) => {
    if (!isEditingControlled) setInternalEditingKeys(next);
    onEditingKeysChange?.(Array.from(next));
  };

  const startEditingRows = (keys: string[]) => {
    const next = new Set(editingKeySet);
    const newlyAdded: string[] = [];
    let remainingCapacity = maxEditingRows - next.size;
    for (const key of keys) {
      if (next.has(key)) continue;
      if (remainingCapacity <= 0) break;
      next.add(key);
      newlyAdded.push(key);
      remainingCapacity--;
    }
    if (newlyAdded.length === 0) {
      if (isDevBuild() && next.size >= maxEditingRows && keys.some(k => !editingKeySet.has(k))) {
        console.warn(`<DataTable editable> is already at its maxEditingRows limit (${maxEditingRows}); ignoring further startEditingRow(s) calls.`);
      }
      return;
    }
    commitEditingKeys(next);
    newlyAdded.forEach(key => {
      const index = recordByEditKey.get(key)?.index ?? -1;
      aiBus.emit('datatable:row_edit_started', { id: tableId, key, index });
    });
    if (isDevBuild() && newlyAdded.length < keys.length) {
      console.warn(
        `<DataTable editable>: requested ${keys.length} row(s) to start editing, but only ${newlyAdded.length} fit under maxEditingRows (${maxEditingRows}). The rest were ignored.`
      );
    }
  };

  const startEditingRow = (key: string) => startEditingRows([key]);

  const cancelEditingRow = (key: string) => {
    if (!editingKeySet.has(key)) return;
    const next = new Set(editingKeySet);
    next.delete(key);
    commitEditingKeys(next);
    const index = recordByEditKey.get(key)?.index ?? -1;
    aiBus.emit('datatable:row_edit_cancelled', { id: tableId, key, index });
  };

  const saveEditingRow = (key: string, values: T) => {
    const next = new Set(editingKeySet);
    next.delete(key);
    commitEditingKeys(next);
    const index = recordByEditKey.get(key)?.index ?? -1;
    aiBus.emit('datatable:row_edit_saved', { id: tableId, key, index, values });
  };

  // The render-safe view -- the ONE thing DataTable.tsx should ever build
  // co-grid rows from. Iteration order of a Set is insertion order, so
  // this deterministically keeps the FIRST `maxEditingRows` keys that
  // entered the set, not an arbitrary subset.
  const cappedEditingKeys = useMemo(() => Array.from(editingKeySet).slice(0, maxEditingRows), [editingKeySet, maxEditingRows]);
  const truncatedEditingCount = Math.max(0, editingKeySet.size - cappedEditingKeys.length);

  // Only reachable via a controlled `editingKeys` prop set larger than the
  // cap directly -- startEditingRow(s) above already refuses to grow the
  // set past it, so this specifically catches the bypass case, not normal
  // usage. A real console.warn (dev-only), not silent -- a consumer
  // driving `editingKeys` themselves needs to know their own state and
  // what's actually rendered have diverged.
  useEffect(() => {
    if (isDevBuild() && truncatedEditingCount > 0) {
      console.warn(
        `<DataTable editable>: editingKeys has ${editingKeySet.size} entries, exceeding maxEditingRows (${maxEditingRows}). Only the first ${maxEditingRows} are rendered in the edit co-grid.`
      );
    }
  }, [truncatedEditingCount, editingKeySet.size, maxEditingRows]);

  // Every editing key whose record is ALSO on the current page/sort/filter
  // view -- unlike selection's currentPageKeys (which exists to scope the
  // 3-state select-all checkbox), this exists purely to drive the pairing
  // highlight between a co-grid row and its main-grid placeholder.
  const currentPageEditingKeys = useMemo(() => {
    if (!editable || editingKeySet.size === 0) return new Set<string>();
    const pageKeys = new Set(currentPageRecords.map((record, i) => getEditingKey(record, i)));
    const intersection = new Set<string>();
    editingKeySet.forEach(key => {
      if (pageKeys.has(key)) intersection.add(key);
    });
    return intersection;
  }, [editable, editingKeySet, currentPageRecords, getEditingKey]);

  return {
    editingKeySet,
    cappedEditingKeys,
    truncatedEditingCount,
    currentPageEditingKeys,
    recordByEditKey,
    getEditingKey,
    startEditingRow,
    startEditingRows,
    cancelEditingRow,
    saveEditingRow,
  };
}
