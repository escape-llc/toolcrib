'use client';

import { useEffect, useRef, useState, type RefObject, type UIEvent } from 'react';

/**
 * Fallback used both for virtualization math and as `DataTable`'s own
 * minimum visible height. Necessary because `containerHeight="auto"` fills
 * its parent via `flex: 1 1 0px` + `height: 100%` — CSS that only resolves
 * to something nonzero when the immediate ancestor is itself a
 * `display: flex; flex-direction: column` box with a definite height (e.g.
 * a `<Splitter.Panel>`). A plain content wrapper like a bare
 * `<TabStrip.Panel>` gives a flex-basis-0 child nothing to grow into, so
 * without this floor the whole table silently collapses to zero height —
 * correctly-rendered rows clipped inside an invisible 0px scroll box,
 * rather than an error. This floor only ever acts as a floor: inside an
 * ancestor that DOES provide real flex height, flex-grow still expands
 * past it exactly as before.
 */
export const AUTO_HEIGHT_FALLBACK_PX = 350;

export interface UseTableVirtualizationOptions {
  bodyRef: RefObject<HTMLDivElement | null>;
  itemHeight: number;
  containerHeight: number | 'auto';
  observedHeight: number;
  totalItems: number;
  /**
   * Changing this value resets the scroll window back to the top -- pass a
   * string combining every piece of state whose change reorders/reslices
   * `totalItems` (page, page size, sort key/direction, ...). See the reset
   * effect below for why this has to cover all of them.
   */
  resetKey: string;
}

export interface UseTableVirtualizationResult {
  startIndex: number;
  endIndex: number;
  effectiveContainerHeight: number;
  isAutoHeight: boolean;
  onScroll: (e: UIEvent<HTMLDivElement>) => void;
}

/**
 * Extracted from `DataTable`'s own inline implementation (see issue #322) --
 * owns the RAF-throttled scroll-position state, the row-windowing math, and
 * the scroll-reset-on-page/sort-change behavior. No public API or behavior
 * change; this is purely an internal-architecture split.
 */
export function useTableVirtualization({
  bodyRef,
  itemHeight,
  containerHeight,
  observedHeight,
  totalItems,
  resetKey,
}: UseTableVirtualizationOptions): UseTableVirtualizationResult {
  const [scrollTop, setScrollTop] = useState(0);

  // Scroll events are throttled to one setScrollTop per animation frame (see
  // onScroll below) via these two refs.
  const latestScrollTopRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);

  // Nothing previously reset scrollTop (state or the real DOM scroll
  // position) when the page changed — scrolling deep into page 1, then
  // paging forward, left the virtualization window (startIndex/endIndex
  // below) computed from a scroll offset that belonged to a completely
  // different page's row count, which could render as an apparently empty
  // table until the user manually scrolled back up. Sorting reorders the
  // current page's rows exactly the same way pagination does, so it has to
  // reset the window too — `resetKey` covers both (and anything else the
  // caller folds in) for that reason, not left out as an oversight.
  //
  // Also cancels any in-flight scroll rAF and clears latestScrollTopRef:
  // without this, a scroll on the *old* page that was still waiting for its
  // throttled frame when the page/sort changed would fire after this reset,
  // calling setScrollTop with the stale pre-change offset and silently
  // undoing the reset above — reintroducing the exact blank-table bug this
  // exists to prevent.
  //
  // The scrollTop *state* reset happens during render (React's documented
  // "adjust state when a dependency changes" pattern), not inside the effect
  // below -- avoids an extra render-then-effect-then-rerender cascade for
  // the state half of this reset. The effect still owns the real-DOM/RAF
  // side effects (cancelling a pending frame, resetting the actual scroll
  // position), which can only happen after commit regardless. Since both
  // run synchronously within the same tick (render+commit+effects all
  // finish before the browser's next animation frame), a still-pending rAF
  // from the old page is cancelled before it could ever fire with a stale
  // offset -- same ordering guarantee the original single-effect version had.
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setScrollTop(0);
  }

  useEffect(() => {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
    latestScrollTopRef.current = 0;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Raw scroll events can fire far faster than one per frame; setting
  // scrollTop straight from each one re-runs the virtualization math (and
  // rowSubtheme/resolveSubtheme for every visible row) that often too.
  // Coalescing to one update per animation frame — keeping only the latest
  // offset via the ref — cuts that to the rate the browser can actually
  // paint at.
  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    latestScrollTopRef.current = e.currentTarget.scrollTop;
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      setScrollTop(latestScrollTopRef.current);
    });
  };

  const effectiveContainerHeight =
    typeof containerHeight === 'number' ? containerHeight : observedHeight > 0 ? observedHeight : AUTO_HEIGHT_FALLBACK_PX;

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 2);
  const visibleCount = Math.ceil(effectiveContainerHeight / itemHeight) + 4;
  const endIndex = Math.min(totalItems, startIndex + visibleCount);

  const isAutoHeight = containerHeight === 'auto';

  return { startIndex, endIndex, effectiveContainerHeight, isAutoHeight, onScroll };
}
