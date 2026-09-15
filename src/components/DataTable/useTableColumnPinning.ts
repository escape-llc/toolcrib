'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import type { Column } from './DataTable';

export interface StickyOffsets {
  /** `Column.key` -> px offset from the grid's left edge, for a `pinned: 'left'` column. */
  left: Map<string, number>;
  /** `Column.key` -> px offset from the grid's right edge, for a `pinned: 'right'` column. */
  right: Map<string, number>;
}

export interface UseTableColumnPinningResult {
  /** Attach to a pinned column's `<th ref={...}>` -- the real measurement basis every offset below is computed from. */
  registerHeaderCellRef: (key: string) => (el: HTMLTableCellElement | null) => void;
  offsets: StickyOffsets;
}

/**
 * Computes real pixel sticky offsets for `<DataTable>`'s `Column.pinned`
 * columns (issue #341) -- deliberately real DOM measurement (`useLayoutEffect`
 * + `getBoundingClientRect()`), not arithmetic over `Column.width`/resized
 * widths. A column's *rendered* width can come from an explicit numeric
 * `width`, a CSS string (`'12rem'`), a live drag-resize override, or the
 * browser's own `table-layout: fixed` distribution of unset columns --
 * measuring the real, already-rendered `<th>` is correct regardless of
 * which of those produced it, where re-deriving the same number from each
 * source independently would mean re-implementing (and risking disagreeing
 * with) the browser's own layout algorithm.
 *
 * Two-pass by necessity: the first render lays out every column normally
 * (nothing has a measured width yet, so pinned columns render at their
 * natural position with no sticky offset); the layout effect then measures
 * every pinned `<th>`'s real rendered width and, only if something actually
 * changed, triggers exactly one more render with the correct offsets
 * applied. Runs on every commit (no dependency array) rather than trying to
 * enumerate every input that could change a pinned column's width (a resize
 * drag, a density change, a column being hidden/shown, a locale string
 * changing header text length) -- the `changed` guard below means this
 * converges to zero extra renders the instant widths stabilize, so the cost
 * of the broader trigger is a cheap, skipped comparison on most commits, not
 * a real performance concern; the alternative (an incomplete dependency
 * list) risks silently stale offsets after some input this list forgot.
 *
 * Measured widths live in real state (`useState`), not a ref -- confirmed
 * the hard way via this repo's own `react-hooks/refs` lint rule (part of
 * the v7 "Rules of React" set): reading `ref.current` during the render
 * phase (which computing `left`/`right` below would otherwise need to do)
 * is a real rule violation, not just a style nit -- React's own docs note a
 * ref's value can be inconsistent across concurrent-rendering attempts of
 * the same commit. `cellsRef` (the live `<th>` DOM node handles themselves)
 * stays a ref correctly, since it's read only inside the effect
 * (event-handler/effect-only access is exactly what refs are for), never
 * during render.
 */
export function useTableColumnPinning<T>(
  visibleColumns: Column<T>[],
  /** Starting left offset (px) for the first left-pinned column -- the selection checkbox/radio column's own width when it auto-pins alongside a left-pinned data column, else 0. */
  leadingOffsetPx: number,
  /** Starting right offset (px) for the first (rightmost) right-pinned column -- the rowCommands actions column's own width when it auto-pins alongside a right-pinned data column, else 0. */
  trailingOffsetPx: number
): UseTableColumnPinningResult {
  const [widths, setWidths] = useState<Map<string, number>>(() => new Map());
  const cellsRef = useRef(new Map<string, HTMLTableCellElement>());

  const registerHeaderCellRef = (key: string) => (el: HTMLTableCellElement | null) => {
    if (el) cellsRef.current.set(key, el);
    else cellsRef.current.delete(key);
  };

  // Deliberately no dependency array -- see this hook's own header comment
  // for why this has to run on every commit rather than trying to
  // enumerate every input that could change a pinned column's real
  // rendered width.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const hasPinned = visibleColumns.some(c => c.pinned);
    if (!hasPinned) return;
    let changed = false;
    const next = new Map(widths);
    for (const col of visibleColumns) {
      if (!col.pinned) continue;
      const el = cellsRef.current.get(col.key);
      if (!el) continue;
      // Rounded, not the raw fractional getBoundingClientRect() value --
      // Gemini's review of this PR correctly flagged that a sub-pixel
      // measurement can jitter by fractions of a px across successive
      // layouts under fractional browser zoom or non-integer display
      // scaling (125%/150%), which the strict `!==` comparison below would
      // otherwise treat as a real change forever, re-triggering setWidths
      // every commit. Rounding first also has no real downside: a sticky
      // offset in fractional pixels isn't any more "correct" than the
      // nearest integer one, so this is a strict improvement either way.
      const width = Math.round(el.getBoundingClientRect().width);
      if (next.get(col.key) !== width) {
        next.set(col.key, width);
        changed = true;
      }
    }
    // This *is* the measurement, not a reaction to some separate external
    // change -- a pinned column's real rendered width can only be read
    // AFTER layout, from inside an effect, and the result has no way to
    // reach this render except through setState (see this hook's own
    // header comment for why `useSyncExternalStore` doesn't fit here
    // either -- there's no external store to subscribe to, just a DOM
    // measurement). The `changed` guard above is what keeps this from
    // becoming the unbounded cascading-render loop this lint rule exists
    // to catch -- once every pinned column's width stabilizes, `changed`
    // stays false and no further render is triggered.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (changed) setWidths(next);
  });

  const left = new Map<string, number>();
  let cumulativeLeft = leadingOffsetPx;
  for (const col of visibleColumns) {
    if (col.pinned !== 'left') continue;
    left.set(col.key, cumulativeLeft);
    cumulativeLeft += widths.get(col.key) ?? 0;
  }

  // Reverse order for right-pinned: the LAST right-pinned column in
  // `columns` order sits flush against the grid's right edge (offset 0),
  // matching how a left-pinned column's cumulative offset grows away from
  // its own edge in forward order.
  const right = new Map<string, number>();
  let cumulativeRight = trailingOffsetPx;
  for (let i = visibleColumns.length - 1; i >= 0; i--) {
    const col = visibleColumns[i];
    if (col.pinned !== 'right') continue;
    right.set(col.key, cumulativeRight);
    cumulativeRight += widths.get(col.key) ?? 0;
  }

  return { registerHeaderCellRef, offsets: { left, right } };
}
