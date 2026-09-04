'use client';

import React, { useMemo } from 'react';
import { UIGroup } from '../UIGroup/UIGroup';
import { Button } from '../Form/FormComponents';
import { useStableId } from '../shared/useStableId';
import { usePagination } from '../shared/usePagination';
import { aiBus } from '../../eventBus/eventBus';
import { useLocaleStrings } from '../Locale/LocaleContext';

/** A page number, or a collapsed run of skipped pages. */
type PageToken = number | 'ellipsis';

// First/last page always shown, plus one sibling on each side of the
// current page -- collapses everything else into a single ellipsis rather
// than rendering every page number for a large dataset.
const SIBLING_COUNT = 1;

function buildPageTokens(currentPage: number, totalPages: number): PageToken[] {
  const totalVisible = SIBLING_COUNT * 2 + 5; // first + last + current + 2 siblings + 2 possible ellipses
  if (totalPages <= totalVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const left = Math.max(currentPage - SIBLING_COUNT, 2);
  const right = Math.min(currentPage + SIBLING_COUNT, totalPages - 1);

  const tokens: PageToken[] = [1];
  if (left > 2) tokens.push('ellipsis');
  for (let page = left; page <= right; page++) tokens.push(page);
  if (right < totalPages - 1) tokens.push('ellipsis');
  tokens.push(totalPages);
  return tokens;
}

export interface PaginationProps {
  /** Unique identifier for `pagination:changed` event bus payloads. Auto-generated if omitted. */
  id?: string;
  /** Total number of items being paged across (not the number of pages). */
  totalItems: number;
  /** Items per page. @default 10 */
  pageSize?: number;
  /**
   * Controlled current page (1-indexed). Pass a value to drive paging from
   * parent state instead of letting `<Pagination>` manage it internally.
   * Omit for the common uncontrolled case; `defaultPage` seeds that
   * internal state instead.
   */
  page?: number;
  /** Initial page when uncontrolled (`page` omitted). @default 1 */
  defaultPage?: number;
  /** Called whenever the page changes, whether controlled or uncontrolled. */
  onPageChange?: (page: number) => void;
  /** Size of the page/nav buttons, passed straight through to the underlying `<Button>`s. @default 'sm' */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * @manifest Page-number navigation control with Prev/Next, built on `<Button>` and shared page-index math with `<DataTable>`
 * @manifestCategory Form Controls
 * @manifestAntiPatternAvoid Hand-roll page-index math (clamping, prev/next, page-size resets)
 * @manifestAntiPatternInstead Use `<Pagination>` — same controlled/uncontrolled `page`/`defaultPage`/`onPageChange` contract as `<DataTable>`'s own paging
 */
export const Pagination: React.FC<PaginationProps> = ({
  id: propId,
  totalItems,
  pageSize = 10,
  page: controlledPage,
  defaultPage,
  onPageChange,
  size = 'sm',
}) => {
  const id = useStableId(propId, 'pagination');
  const strings = useLocaleStrings().pagination;

  const { currentPage, totalPages, goToPage } = usePagination({
    totalItems,
    pageSize,
    page: controlledPage,
    defaultPage,
    onPageChange: page => {
      onPageChange?.(page);
      aiBus.emit('pagination:changed', { id, page, pageSize });
    },
  });

  const tokens = useMemo(() => buildPageTokens(currentPage, totalPages), [currentPage, totalPages]);

  // Left/Right arrow keys move to the adjacent page from anywhere inside
  // this control, in addition to each button already being individually
  // Tab/Enter/Space-operable for free as a native <button> -- matches the
  // roving-navigation feel of a real pagination widget rather than relying
  // on Tab alone to step through every page button one at a time.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goToPage(currentPage - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goToPage(currentPage + 1);
    }
  };

  return (
    <nav aria-label={strings.navLabel} onKeyDown={handleKeyDown}>
      <UIGroup>
        <Button
          variant="outline"
          size={size}
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label={strings.previousPage}
        >
          ◀
        </Button>

        {tokens.map((token, i) =>
          token === 'ellipsis' ? (
            <Button key={`ellipsis-${i}`} variant="ghost" size={size} disabled aria-hidden="true">
              …
            </Button>
          ) : (
            <Button
              key={token}
              variant={token === currentPage ? 'primary' : 'outline'}
              size={size}
              onClick={() => goToPage(token)}
              aria-label={strings.page(token)}
              aria-current={token === currentPage ? 'page' : undefined}
            >
              {token}
            </Button>
          )
        )}

        <Button
          variant="outline"
          size={size}
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label={strings.nextPage}
        >
          ▶
        </Button>
      </UIGroup>
    </nav>
  );
};
