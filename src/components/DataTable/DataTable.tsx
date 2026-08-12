import React, { useState, useMemo, useRef, useEffect, ReactNode } from 'react';
import { UIGroup } from '../UIGroup/UIGroup';
import { Z_INDEX } from '../../theme/zIndex';
import { useAdaptiveSize } from '../../observer/useAdaptiveSize';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { DataTableThemeSlice, TableSliceState } from './DataTableSlice';

/** Column definition for `<DataTable>`. */
export interface Column<T = any> {
  /** Property key on the data record to read the cell value from. */
  key: string;
  /** Header text for this column. */
  title: string;
  /** Custom cell renderer. Receives the cell value, full record, and row index. */
  render?: (value: any, record: T, index: number) => ReactNode;
  /** If true, clicking this column header toggles sorting. @default false */
  sortable?: boolean;
  /** Column width as CSS value (e.g. `'12rem'`) or number (px). */
  width?: string | number;
}

/**
 * Props for the `<DataTable>` virtualized, sortable, paginated data grid.
 *
 * Supports client-side sorting and pagination out of the box.
 */
export interface DataTableProps<T = any> {
  /** Array of data records to display. */
  data: T[];
  /** Column definitions controlling header, cell rendering, and sorting. */
  columns: Column<T>[];
  /**
   * Initial number of rows per page.
   * @default 10
   */
  pageSize?: number;
  /**
   * Options shown in the page-size dropdown.
   * @default [5, 10, 25, 50, 100]
   */
  pageSizeOptions?: number[];
  /**
   * Height of each row in pixels (used for virtualization calculations).
   * @default 44
   */
  itemHeight?: number;
  /**
   * Container height. `'auto'` fills available space. A number sets a fixed pixel height.
   * @default 'auto'
   */
  containerHeight?: number | 'auto';
  /** Custom row key extractor for React reconciliation. Defaults to array index. */
  rowKey?: (record: T, index: number) => string | number;
  /** Per-instance overrides for density, border style, and striping. */
  overrides?: Partial<TableSliceState>;
}

/**
 * @manifest Virtualized, sortable, paginated data table with sticky headers
 * @manifestCategory Data Display
 */
export function DataTable<T extends Record<string, any> = Record<string, any>>({
  data,
  columns,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [5, 10, 25, 50, 100],
  itemHeight = 44,
  containerHeight = 'auto',
  rowKey,
  overrides,
}: DataTableProps<T>) {
  const { vars } = useSliceOverrides(DataTableThemeSlice, overrides);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [scrollTop, setScrollTop] = useState(0);

  const bodyRef = useRef<HTMLDivElement>(null);
  const { height: observedHeight } = useAdaptiveSize(bodyRef);

  // Nothing previously reset scrollTop (state or the real DOM scroll
  // position) when the page changed — scrolling deep into page 1, then
  // paging forward, left the virtualization window (startIndex/endIndex
  // below) computed from a scroll offset that belonged to a completely
  // different page's row count, which could render as an apparently empty
  // table until the user manually scrolled back up.
  useEffect(() => {
    setScrollTop(0);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize]);

  // 1. Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDirection]);

  // 2. Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, validCurrentPage, pageSize]);

  // 3. Virtualization within current page view & adaptive height
  const totalItems = paginatedData.length;
  // Fallback used both for virtualization math and as this component's own
  // minimum visible height below. Necessary because containerHeight="auto"
  // fills its parent via `flex: 1 1 0px` + `height: 100%` — CSS that only
  // resolves to something nonzero when the immediate ancestor is itself a
  // `display: flex; flex-direction: column` box with a definite height
  // (e.g. a `<Splitter.Panel>`). A plain content wrapper like a bare
  // `<TabStrip.Panel>` gives a flex-basis-0 child nothing to grow into, so
  // without this floor the whole table silently collapses to zero height —
  // correctly-rendered rows clipped inside an invisible 0px scroll box,
  // rather than an error. The `minHeight` below only ever acts as a floor:
  // inside an ancestor that DOES provide real flex height, flex-grow still
  // expands past it exactly as before.
  const AUTO_HEIGHT_FALLBACK_PX = 350;
  const effectiveContainerHeight =
    typeof containerHeight === 'number' ? containerHeight : observedHeight > 0 ? observedHeight : AUTO_HEIGHT_FALLBACK_PX;

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 2);
  const visibleCount = Math.ceil(effectiveContainerHeight / itemHeight) + 4;
  const endIndex = Math.min(totalItems, startIndex + visibleCount);

  const visibleRows = paginatedData.slice(startIndex, endIndex);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else setSortKey(null);
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const isAutoHeight = containerHeight === 'auto';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        border: '0.0625rem solid var(--ai-border, #e5e7eb)',
        borderRadius: 'var(--ai-radius-lg, 0.5rem)',
        overflow: 'hidden',
        background: 'var(--ai-bg-surface, #ffffff)',
        fontFamily: 'inherit',
        width: '100%',
        height: isAutoHeight ? '100%' : undefined,
        flex: isAutoHeight ? '1 1 0px' : undefined,
        minHeight: isAutoHeight ? `${AUTO_HEIGHT_FALLBACK_PX / 16}rem` : 0,
        ...vars,
      }}
    >
      {/* Scrollable Virtualized Body (Fills parent flex box when containerHeight="auto") */}
      <div
        ref={bodyRef}
        onScroll={onScroll}
        style={{
          height: typeof containerHeight === 'number' ? `${containerHeight / 16}rem` : undefined,
          flex: isAutoHeight ? '1 1 0px' : undefined,
          minHeight: isAutoHeight ? `${AUTO_HEIGHT_FALLBACK_PX / 16}rem` : 0,
          overflowY: 'auto',
          position: 'relative',
          width: '100%',
        }}
      >
        <table
          style={{
            width: '100%',
            tableLayout: 'fixed',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.875rem',
          }}
        >
          <colgroup>
            {columns.map(col => (
              <col key={col.key} style={{ width: col.width ? (typeof col.width === 'number' ? `${col.width}px` : col.width) : undefined }} />
            ))}
          </colgroup>

          {/* Header */}
          <thead
            style={{
              position: 'sticky',
              top: 0,
              zIndex: Z_INDEX.STICKY,
              background: 'var(--ai-bg-container, #f9fafb)',
              borderBottom: '0.0625rem solid var(--ai-border, #e5e7eb)',
            }}
          >
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={{
                    padding: 'var(--ai-table-header-padding, var(--ai-padding-md, 0.75rem 1rem))',
                    fontWeight: 600,
                    color: 'var(--ai-text-primary, #111827)',
                    cursor: col.sortable !== false ? 'pointer' : 'default',
                    userSelect: 'none',
                    width: col.width,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    {col.title}
                    {col.sortable !== false && sortKey === col.key && (
                      <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Virtual Spacer Top */}
          <tbody>
            {startIndex > 0 && (
              <tr>
                <td colSpan={columns.length} style={{ height: `${(startIndex * itemHeight) / 16}rem`, padding: 0 }} />
              </tr>
            )}

            {/* Visible Rows */}
            {visibleRows.map((record, relativeIndex) => {
              const actualIndex = startIndex + relativeIndex;
              const key = rowKey ? rowKey(record, actualIndex) : actualIndex;
              return (
                <tr
                  key={key}
                  style={{
                    height: `${itemHeight / 16}rem`,
                    borderBottom: '0.0625rem solid var(--ai-border, #f3f4f6)',
                    background: actualIndex % 2 === 0 ? 'transparent' : 'var(--ai-table-stripe-bg, var(--ai-bg-container, #f9fafb))',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {columns.map(col => {
                    const value = record[col.key];
                    return (
                      <td
                        key={col.key}
                        style={{
                          padding: 'var(--ai-table-cell-padding, var(--ai-padding-sm, 0.5rem 1rem))',
                          color: 'var(--ai-text-primary, #111827)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          borderRight: 'var(--ai-table-border, none)',
                        }}
                      >
                        {col.render ? col.render(value, record, actualIndex) : String(value ?? '')}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Virtual Spacer Bottom */}
            {endIndex < totalItems && (
              <tr>
                <td colSpan={columns.length} style={{ height: `${((totalItems - endIndex) * itemHeight) / 16}rem`, padding: 0 }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.625rem 1rem',
          borderTop: '0.0625rem solid var(--ai-border, #e5e7eb)',
          background: 'var(--ai-bg-container, #f9fafb)',
          fontSize: '0.875rem',
          flex: '0 0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ color: 'var(--ai-text-secondary, #6b7280)' }}>
          Showing {totalItems > 0 ? (validCurrentPage - 1) * pageSize + 1 : 0} to{' '}
          {Math.min(validCurrentPage * pageSize, sortedData.length)} of {sortedData.length} entries
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <UIGroup>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                padding: '0.25rem 0.5rem',
                border: '0.0625rem solid var(--ai-border, #d1d5db)',
                background: 'var(--ai-bg-surface, #ffffff)',
                color: 'var(--ai-text-primary, #111827)',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
              {pageSizeOptions.map(opt => (
                <option key={opt} value={opt}>
                  {opt} per page
                </option>
              ))}
            </select>

            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={validCurrentPage === 1}
              aria-label="Previous page"
              style={{
                padding: '0.25rem 0.5rem',
                border: '0.0625rem solid var(--ai-border, #d1d5db)',
                background: 'var(--ai-bg-surface, #ffffff)',
                color: 'var(--ai-text-primary, #111827)',
                fontSize: '0.75rem',
                cursor: validCurrentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: validCurrentPage === 1 ? 0.5 : 1,
              }}
            >
              ◀
            </button>

            <span
              style={{
                padding: '0.25rem 0.5rem',
                border: '0.0625rem solid var(--ai-border, #d1d5db)',
                background: 'var(--ai-bg-surface, #ffffff)',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--ai-text-primary, #111827)',
              }}
            >
              {validCurrentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={validCurrentPage === totalPages}
              aria-label="Next page"
              style={{
                padding: '0.25rem 0.5rem',
                border: '0.0625rem solid var(--ai-border, #d1d5db)',
                background: 'var(--ai-bg-surface, #ffffff)',
                color: 'var(--ai-text-primary, #111827)',
                fontSize: '0.75rem',
                cursor: validCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: validCurrentPage === totalPages ? 0.5 : 1,
              }}
            >
              ▶
            </button>
          </UIGroup>
        </div>
      </div>
    </div>
  );
}
