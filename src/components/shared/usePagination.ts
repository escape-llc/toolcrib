'use client';

import { useState } from 'react';

export interface UsePaginationOptions {
  /** Total number of items being paged across. */
  totalItems: number;
  /** Items per page. */
  pageSize: number;
  /** Controlled current page (1-indexed). Omit for uncontrolled. */
  page?: number;
  /** Initial page when uncontrolled (`page` omitted). @default 1 */
  defaultPage?: number;
  /** Called whenever the page changes, whether controlled or uncontrolled. */
  onPageChange?: (page: number) => void;
}

export interface UsePaginationResult {
  /** Current page, already clamped to `[1, totalPages]` — safe to render directly. */
  currentPage: number;
  /** `Math.max(1, Math.ceil(totalItems / pageSize))` — always at least 1, even for an empty dataset. */
  totalPages: number;
  /** Whether `page` was passed (controlled) rather than left to internal state. */
  isPageControlled: boolean;
  /** Clamps `page` to `[1, totalPages]`, updates internal state when uncontrolled, and calls `onPageChange`. */
  goToPage: (page: number) => void;
}

/**
 * Page-index math shared by `<DataTable>` (its internal pagination footer)
 * and `<Pagination>` — extracted from `<DataTable>`'s own implementation so
 * there is exactly one page-clamping/controlled-state implementation in the
 * codebase, not two that can drift. Same controlled/uncontrolled contract
 * as `<DataTable>`'s own `page`/`defaultPage`/`onPageChange` props, and
 * `<TabStrip>`'s `activeId` before it: a `page` of `undefined` means
 * "manage it internally," anything else means the caller owns that state.
 */
export function usePagination({
  totalItems,
  pageSize,
  page: controlledPage,
  defaultPage,
  onPageChange,
}: UsePaginationOptions): UsePaginationResult {
  const [internalPage, setInternalPage] = useState(defaultPage ?? 1);
  const isPageControlled = controlledPage !== undefined;
  const rawCurrentPage = isPageControlled ? (controlledPage as number) : internalPage;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  // Derived, render-only clamp -- doesn't by itself write back into
  // `internalPage`. See the effect below for why that's still needed.
  const currentPage = Math.min(rawCurrentPage, totalPages);

  // If `totalItems` shrinks (a search/filter narrows the dataset) then
  // grows back, the clamp above keeps rendering correctly the whole time,
  // but `internalPage` itself was never written back down -- so growing
  // back past the old, now-stale `internalPage` silently jumps straight to
  // it instead of staying on the page the caller was just looking at.
  // Syncing the actual state here, once, whenever `totalPages` changes is
  // what makes the render-only clamp durable instead of cosmetic. Skipped
  // when controlled -- that state is the caller's to own, not something
  // this can write back into.
  //
  // Adjusted during render, not via a useEffect -- React's own documented
  // pattern for "sync state when a derived value changes" (see Slider.tsx's
  // identical shape/comment). Avoids the extra render-then-effect-then-
  // rerender cascade a useEffect version would cause.
  const [prevTotalPages, setPrevTotalPages] = useState(totalPages);
  if (!isPageControlled && totalPages !== prevTotalPages) {
    setPrevTotalPages(totalPages);
    setInternalPage(p => Math.min(p, totalPages));
  }

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(page, totalPages));
    if (!isPageControlled) setInternalPage(clamped);
    onPageChange?.(clamped);
  };

  return { currentPage, totalPages, isPageControlled, goToPage };
}
