'use client';

import { useEffect, useRef, useState, type RefObject, type KeyboardEvent, type FocusEvent } from 'react';

export interface UseTableKeyboardNavOptions {
  tableRef: RefObject<HTMLTableElement | null>;
  bodyRef: RefObject<HTMLDivElement | null>;
  /** Total navigable columns (aria-colcount) -- the selection column, if any, plus every data column. */
  columnCount: number;
  /** Rows navigable on the CURRENT page (`paginatedData.length`, not the virtualized-visible subset) -- keyboard nav is scoped to the current page; crossing a page boundary needs an explicit page change, not arrow keys. */
  pageRowCount: number;
  itemHeight: number;
  /** The virtualization window's current bounds, page-relative (see `useTableVirtualization`). */
  startIndex: number;
  endIndex: number;
}

export interface UseTableKeyboardNavResult {
  /** `0` = header row; `1..pageRowCount` = body rows (page-relative, matching `actualIndex + 1`). */
  focusedRow: number;
  focusedCol: number;
  /** Attach to the `<table>`'s `onKeyDown`. */
  handleKeyDown: (e: KeyboardEvent<HTMLTableElement>) => void;
  /**
   * Attach to the `<table>`'s `onFocus` -- keeps the roving-tabindex state
   * in sync with focus arriving by any means (a mouse click, programmatic
   * focus), not just this hook's own arrow-key navigation. Without this, a
   * click on some other cell would leave `tabIndex="0"` pinned to whatever
   * cell arrow-key navigation last visited, not the cell the user can
   * actually see is focused.
   */
  handleFocus: (e: FocusEvent<HTMLTableElement>) => void;
}

/**
 * Real WAI-ARIA grid keyboard navigation for `<DataTable>` (see issue
 * #316) -- roving tabindex across header + body cells, arrow-key/Home/End/
 * Ctrl+Home/Ctrl+End movement per the W3C APG Grid pattern
 * (https://www.w3.org/WAI/ARIA/apg/patterns/grid/), and virtualization-
 * aware scrolling so navigating to a row outside the current render window
 * still works.
 *
 * Deliberate scope limits, not oversights:
 * - Navigation is scoped to the current page. Reaching the end of a page
 *   via Home/End/Arrow does not cross into an adjacent page -- that would
 *   mean triggering a full data reload mid-keystroke, a real, separate
 *   design question left for a future issue if ever needed.
 * - A column's own custom `column.render` content may contain its own
 *   interactive elements (e.g. an action button) -- those remain
 *   independently reachable via the browser's native Tab order rather than
 *   being suppressed into a strict single-composite-widget model. The APG
 *   pattern's own "cell contains one widget" simplification (grid
 *   navigation keys focus that widget directly) is applied only to
 *   `DataTable`'s own fixed, known cell markup (the selection checkbox,
 *   the sortable-header button) -- not to arbitrary consumer-supplied
 *   render output, which this hook has no safe way to introspect or
 *   suppress focus within.
 */
export function useTableKeyboardNav({
  tableRef,
  bodyRef,
  columnCount,
  pageRowCount,
  itemHeight,
  startIndex,
  endIndex,
}: UseTableKeyboardNavOptions): UseTableKeyboardNavResult {
  const [rawFocusedRow, setFocusedRow] = useState(0);
  const [rawFocusedCol, setFocusedCol] = useState(0);
  // A page-size change or a shrinking dataset can leave the raw state
  // pointing past the new bounds -- clamped during render (not synced back
  // via a setState-in-effect, which would just trigger an extra render for
  // a value already derivable from what's already in hand) rather than
  // silently targeting a coordinate that no longer exists.
  const focusedRow = Math.min(rawFocusedRow, pageRowCount);
  const focusedCol = Math.min(rawFocusedCol, Math.max(0, columnCount - 1));

  // Set whenever a move targets a coordinate that isn't in the DOM yet
  // (virtualized out, or not yet re-rendered after a scroll adjustment).
  // The effect below retries on every render until it finds the real
  // element to call .focus() on -- necessary because scrolling the target
  // row into view (via a direct bodyRef.scrollTop write, below) doesn't
  // itself produce that row's DOM node; that only happens once the
  // resulting native `scroll` event flows through this table's existing
  // onScroll -> setScrollTop -> re-render pipeline and startIndex/endIndex
  // actually catch up.
  const pendingFocusRef = useRef<{ row: number; col: number } | null>(null);

  const focusCell = (row: number, col: number) => {
    setFocusedRow(row);
    setFocusedCol(col);
    pendingFocusRef.current = { row, col };

    const bodyRowIndex = row - 1; // meaningful only when row > 0 (a body row)
    if (row > 0 && (bodyRowIndex < startIndex || bodyRowIndex >= endIndex) && bodyRef.current) {
      // Outside the current virtualization window -- top-align the target
      // row rather than computing a minimal scroll delta. Simpler, and the
      // existing +/-2/4-row buffer already means a single-step arrow move
      // rarely even reaches this branch; the correctness bar this exists
      // for (the row becomes visible at all) doesn't need pixel-perfect
      // minimal scrolling on top of that.
      bodyRef.current.scrollTop = bodyRowIndex * itemHeight;
    }
  };

  // Runs after every render (no dep array) rather than only when
  // pendingFocusRef changes, since a ref update alone doesn't trigger a
  // re-run -- this needs to keep checking across each render the scroll
  // adjustment above eventually produces, not just the render right after
  // focusCell was called.
  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    const el = tableRef.current?.querySelector<HTMLElement>(
      `[data-grid-row="${pending.row}"][data-grid-col="${pending.col}"]`
    );
    if (el) {
      el.focus();
      pendingFocusRef.current = null;
    }
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    let nextRow = focusedRow;
    let nextCol = focusedCol;
    let handled = true;

    switch (e.key) {
      case 'ArrowUp':
        nextRow = Math.max(0, focusedRow - 1);
        break;
      case 'ArrowDown':
        nextRow = Math.min(pageRowCount, focusedRow + 1);
        break;
      case 'ArrowLeft':
        nextCol = Math.max(0, focusedCol - 1);
        break;
      case 'ArrowRight':
        nextCol = Math.min(columnCount - 1, focusedCol + 1);
        break;
      case 'Home':
        // Row-scoped: "moves focus to the first cell in the row that
        // contains focus" (W3C APG). Ctrl+Home extends this to the whole
        // grid's first cell.
        nextCol = 0;
        if (e.ctrlKey) nextRow = 0;
        break;
      case 'End':
        nextCol = columnCount - 1;
        if (e.ctrlKey) nextRow = pageRowCount;
        break;
      default:
        handled = false;
    }

    if (!handled) return;
    e.preventDefault();
    if (nextRow !== focusedRow || nextCol !== focusedCol) {
      focusCell(nextRow, nextCol);
    }
  };

  const handleFocus = (e: FocusEvent<HTMLTableElement>) => {
    const target = e.target as HTMLElement;
    const rowAttr = target.dataset.gridRow;
    const colAttr = target.dataset.gridCol;
    if (rowAttr === undefined || colAttr === undefined) return;
    const row = Number(rowAttr);
    const col = Number(colAttr);
    if (row !== focusedRow) setFocusedRow(row);
    if (col !== focusedCol) setFocusedCol(col);
  };

  return { focusedRow, focusedCol, handleKeyDown, handleFocus };
}
