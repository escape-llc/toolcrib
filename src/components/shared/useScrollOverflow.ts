import { useState, useEffect, useCallback, type RefObject, type DependencyList } from 'react';
import { useAdaptiveSize } from '../../observer/useAdaptiveSize';

/** @barrelExport */
export interface UseScrollOverflowResult {
  /** Whether the container currently has hidden content to the left (scrolled right of its start). */
  canScrollLeft: boolean;
  /** Whether the container currently has hidden content to the right (not yet scrolled to its end). */
  canScrollRight: boolean;
  /** Smooth-scrolls the container horizontally by `delta` pixels (negative scrolls left). */
  scrollBy: (delta: number) => void;
}

/**
 * Tracks whether a horizontally-scrollable container has more content
 * hidden off either edge, re-checking on scroll and whenever the
 * container's own width changes (via `useAdaptiveSize`'s shared
 * `ResizeObserver`, never a second one — ground rule 10) or any of `deps`
 * changes (typically the scrolled item list itself, since adding/removing
 * items can flip overflow without the container's width changing at all).
 *
 * Extracted from `TabStrip`'s own filmstrip-overflow logic (its `@manifest`
 * tag already named this exact behavior "filmstrip overflow") so `Filmstrip`
 * can reuse the identical detection instead of a second, parallel
 * implementation that could drift from it.
 */
export function useScrollOverflow(
  containerRef: RefObject<HTMLElement | null>,
  deps: DependencyList = []
): UseScrollOverflowResult {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const { width } = useAdaptiveSize(containerRef);

  const checkScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, [containerRef]);

  useEffect(() => {
    checkScroll();
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => checkScroll();
    el.addEventListener('scroll', handleScroll);

    return () => {
      el.removeEventListener('scroll', handleScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, checkScroll, ...deps]);

  const scrollBy = (delta: number) => {
    containerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return { canScrollLeft, canScrollRight, scrollBy };
}
