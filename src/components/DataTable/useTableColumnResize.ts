'use client';

import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Column } from './DataTable';

/**
 * Default floor for a resizable column's width, in px -- matches
 * `itemHeight`'s own established precedent (a plain numeric px prop, not a
 * `rem` CSS value) for the same reason: this is a value compared directly
 * against `getBoundingClientRect()`/`clientX`, both always reported in real
 * device pixels, not a styled CSS property this repo's `rem`-only rule
 * governs. Prevents a variant of the real `table-layout: fixed`
 * column-collapse defect documented in this project's own competitive
 * research -- that one came from an unset width losing a layout fight with
 * sibling columns; this prevents the same *visual outcome* (an
 * unreadable, near-zero-width column) via drag instead.
 */
export const DEFAULT_MIN_COLUMN_WIDTH = 40;

/**
 * A generous, not-really-enforced ceiling purely so the resize handle's own
 * `aria-valuemax` has something bounded to report -- real drag width has no
 * functional cap above the min floor otherwise. Several real separator/
 * resize-handle implementations report a fixed generous max the same way,
 * rather than omitting `aria-valuemax` entirely.
 */
export const RESIZE_HANDLE_ARIA_VALUEMAX = 800;

/** Arrow-key resize step, in px. Shift+Arrow uses the larger step -- same shape as Splitter's own shiftKey convention. */
const RESIZE_STEP_SMALL = 10;
const RESIZE_STEP_LARGE = 50;

export interface UseTableColumnResizeOptions {
  columnWidths?: Record<string, number>;
  defaultColumnWidths?: Record<string, number>;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
}

export interface UseTableColumnResizeResult {
  /** The column's rendered width right now -- an in-progress drag preview, else a committed override, else the column's own configured `width`. */
  getColumnWidth: (column: Column<any>) => string | number | undefined;
  /** True while this specific column is actively being dragged (for visual feedback on the handle itself). */
  isResizing: (columnKey: string) => boolean;
  /** aria-valuenow/min/max for a resizable column's handle. */
  getAriaValues: (column: Column<any>) => { valueNow: number; valueMin: number; valueMax: number };
  /** Attach to the resize handle's onMouseDown/onPointerDown. `headerCell` is measured directly (its real rendered width) as the drag basis -- robust regardless of whether `Column.width` was ever set, or was a CSS string. */
  startResize: (column: Column<any>, headerCell: HTMLElement, clientX: number) => void;
  /** Attach to the resize handle's onKeyDown -- Arrow keys (Shift for a bigger step), Home/End. */
  handleResizeKeyDown: (column: Column<any>, headerCell: HTMLElement, e: ReactKeyboardEvent) => void;
}

/**
 * Drag-to-resize columns for `<DataTable>` (see issue #318), following the
 * same real, working pattern `<Splitter>`'s own resize handle already
 * establishes in this codebase: `role="separator"` with `aria-valuenow`/
 * `aria-valuemin`/`aria-valuemax`, a live visual value during the drag kept
 * separate from a single external commit on release (never floods
 * `onColumnWidthsChange` on every pointermove tick -- important for the
 * "persist to localStorage" use case the issue itself names), and
 * window-level pointer listeners attached via `useLayoutEffect` (not
 * `useEffect`) so a fast drag's first pointermove can't fire before they've
 * attached. The owner window is derived from the actual header cell
 * element passed to `startResize`, not the bare global `window` -- correct
 * for a table portaled into a different document (e.g. an iframe), same
 * reasoning as `Splitter.tsx`'s own `ownerDocument.defaultView` comment.
 *
 * ARIA shape confirmed against the W3C APG Window Splitter pattern
 * (https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/) before
 * implementing: a column resize handle is what that pattern calls a
 * "vertical splitter" (its own line runs vertically, moved by Left/Right
 * arrow keys) -- `aria-orientation="vertical"` on the handle reflects that.
 */
export function useTableColumnResize({
  columnWidths: controlledWidths,
  defaultColumnWidths,
  onColumnWidthsChange,
}: UseTableColumnResizeOptions): UseTableColumnResizeResult {
  const [internalWidths, setInternalWidths] = useState<Record<string, number>>(defaultColumnWidths ?? {});
  const isControlled = controlledWidths !== undefined;
  const widths = isControlled ? controlledWidths! : internalWidths;

  const commitWidth = useCallback(
    (columnKey: string, width: number) => {
      const next = { ...widths, [columnKey]: width };
      if (!isControlled) setInternalWidths(next);
      onColumnWidthsChange?.(next);
    },
    [widths, isControlled, onColumnWidthsChange]
  );

  const resolveMinWidth = (column: Column<any>): number => column.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;

  // Live drag preview -- deliberately separate state from `widths` above.
  // Updates every pointermove tick for smooth visual feedback; `widths`
  // (and the onColumnWidthsChange callback) only change once, when the
  // drag actually ends.
  const [dragPreview, setDragPreview] = useState<{ key: string; width: number } | null>(null);
  const latestDragPreviewRef = useRef<{ key: string; width: number } | null>(null);
  const dragContextRef = useRef<{
    key: string;
    minWidth: number;
    startWidth: number;
    startClientX: number;
    ownerWindow: Window;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getColumnWidth = (column: Column<any>): string | number | undefined => {
    if (dragPreview?.key === column.key) return dragPreview.width;
    const override = widths[column.key];
    if (override !== undefined) return override;
    return column.width;
  };

  const isResizing = (columnKey: string): boolean => dragPreview?.key === columnKey;

  const getAriaValues = (column: Column<any>) => {
    const current = getColumnWidth(column);
    return {
      valueNow: typeof current === 'number' ? Math.round(current) : resolveMinWidth(column),
      valueMin: resolveMinWidth(column),
      valueMax: RESIZE_HANDLE_ARIA_VALUEMAX,
    };
  };

  const startResize = (column: Column<any>, headerCell: HTMLElement, clientX: number) => {
    const startWidth = headerCell.getBoundingClientRect().width;
    const ownerWindow = headerCell.ownerDocument.defaultView ?? window;
    dragContextRef.current = {
      key: column.key,
      minWidth: resolveMinWidth(column),
      startWidth,
      startClientX: clientX,
      ownerWindow,
    };
    const preview = { key: column.key, width: startWidth };
    latestDragPreviewRef.current = preview;
    setDragPreview(preview);
    setIsDragging(true);
  };

  // useLayoutEffect, not useEffect -- see this file's own header comment
  // (and Splitter.tsx's identical reasoning): these window-level listeners
  // must attach synchronously within the same commit as isDragging becoming
  // true, or a fast drag gesture's first pointermove can fire before a
  // deferred effect has attached, dropping that first tick.
  useLayoutEffect(() => {
    if (!isDragging) return;
    const ctx = dragContextRef.current;
    if (!ctx) return;

    const handleMove = (e: MouseEvent | PointerEvent) => {
      const delta = e.clientX - ctx.startClientX;
      const preview = { key: ctx.key, width: Math.max(ctx.minWidth, ctx.startWidth + delta) };
      latestDragPreviewRef.current = preview;
      setDragPreview(preview);
    };

    const handleUp = () => {
      setIsDragging(false);
      const finalPreview = latestDragPreviewRef.current;
      setDragPreview(null);
      dragContextRef.current = null;
      if (finalPreview) commitWidth(finalPreview.key, finalPreview.width);
    };

    ctx.ownerWindow.addEventListener('mousemove', handleMove);
    ctx.ownerWindow.addEventListener('mouseup', handleUp);
    ctx.ownerWindow.addEventListener('pointermove', handleMove);
    ctx.ownerWindow.addEventListener('pointerup', handleUp);

    return () => {
      ctx.ownerWindow.removeEventListener('mousemove', handleMove);
      ctx.ownerWindow.removeEventListener('mouseup', handleUp);
      ctx.ownerWindow.removeEventListener('pointermove', handleMove);
      ctx.ownerWindow.removeEventListener('pointerup', handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging]);

  const handleResizeKeyDown = (column: Column<any>, headerCell: HTMLElement, e: ReactKeyboardEvent) => {
    const minWidth = resolveMinWidth(column);
    const currentRaw = getColumnWidth(column);
    const currentWidth = typeof currentRaw === 'number' ? currentRaw : headerCell.getBoundingClientRect().width;
    const step = e.shiftKey ? RESIZE_STEP_LARGE : RESIZE_STEP_SMALL;

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        commitWidth(column.key, Math.max(minWidth, currentWidth - step));
        break;
      case 'ArrowRight':
        e.preventDefault();
        commitWidth(column.key, currentWidth + step);
        break;
      case 'Home':
        e.preventDefault();
        commitWidth(column.key, minWidth);
        break;
      case 'End':
        e.preventDefault();
        commitWidth(column.key, RESIZE_HANDLE_ARIA_VALUEMAX);
        break;
      default:
        break;
    }
  };

  return { getColumnWidth, isResizing, getAriaValues, startResize, handleResizeKeyDown };
}
