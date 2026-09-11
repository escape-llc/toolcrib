'use client';

import { useMemo, useRef, useState, useLayoutEffect, type ReactNode } from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { UIGroup } from '../UIGroup/UIGroup';
import { Toolbar } from '../Toolbar/Toolbar';
import { Z_INDEX } from '../../theme/zIndex';
import { useAdaptiveSize } from '../../observer/useAdaptiveSize';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { resolveSubtheme, type SubthemeName, type SubthemeColors } from '../../theme/subtheme';
import { useStableId } from '../shared/useStableId';
import { usePagination } from '../shared/usePagination';
import { aiBus } from '../../eventBus/eventBus';
import { DataTableThemeSlice, type TableSliceState } from './DataTableSlice';
import { useLocaleStrings } from '../Locale/LocaleContext';
import { useTableSort } from './useTableSort';
import { useTableSelection } from './useTableSelection';
import { useTableVirtualization, AUTO_HEIGHT_FALLBACK_PX } from './useTableVirtualization';
import { useTableKeyboardNav } from './useTableKeyboardNav';

/** Argument passed to a `Column.render` callback for one cell. */
export interface CellContext<T = any> {
  /** This cell's resolved value — from `accessorFn` if given, else `record[key]`. */
  value: unknown;
  /** The full data record for this cell's row. */
  row: T;
  /**
   * This row's index — matches `rowKey`/`rowSubtheme`/`onRowClick`'s
   * `index` exactly (see `rowSubtheme`'s doc for its page-relative vs.
   * absolute distinction, which applies here too).
   */
  index: number;
}

/** Column definition for `<DataTable>`. */
export interface Column<T = any> {
  /**
   * Property key on the data record to read the cell value from, and
   * this column's identifier for sorting/React-key purposes. Typed
   * against `T` — with a plain-string fallback preserved so this isn't a
   * breaking change for existing callers — so an editor/AI agent gets
   * real autocomplete instead of guessing a property name. Still
   * required when `accessorFn` is given, as this column's stable id;
   * pick any string in that case, since the value itself comes from
   * `accessorFn` instead.
   */
  key: (keyof T & string) | (string & {});
  /**
   * Computed cell value for a column that isn't a direct property read
   * (a concatenation, a derived/formatted field). Receives the full
   * record and takes precedence over `record[key]` when given — this
   * column also participates in sorting through it.
   */
  accessorFn?: (record: T) => unknown;
  /** Header text for this column. */
  title: string;
  /** Custom cell renderer. Receives this cell's value/row/index as a single object. */
  render?: (context: CellContext<T>) => ReactNode;
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
  /**
   * Identifier included in this instance's `datatable:sorted`/
   * `datatable:paginated`/`datatable:row_clicked` event bus payloads, so a
   * listener watching multiple tables can tell them apart. Auto-generated
   * if omitted (still included in payloads either way) — unlike
   * `Modal`/`Popup`/`Accordion`'s `id`, there's no bus-driven open/close
   * counterpart to target, so this exists purely for event attribution.
   */
  id?: string;
  /** Array of data records to display. */
  data: T[];
  /** Column definitions controlling header, cell rendering, and sorting. */
  columns: Column<T>[];
  /**
   * Renders a page-at-a-time with Prev/Next controls when true (the
   * default). Set to false to virtualize across the *entire* sorted
   * dataset instead — no pagination footer, no page slicing — the
   * better fit once a dataset is too large to page through usefully.
   * `pageSize`/`pageSizeOptions` are ignored in this mode.
   * @default true
   */
  pagination?: boolean;
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
  /**
   * Styles a row. Return either:
   * - One of the toolkit's four semantic subtheme names (`'error'` /
   *   `'success'` / `'warning'` / `'info'`) — resolved via
   *   `theme/subtheme.ts`'s `resolveSubtheme` into the same
   *   WCAG-guaranteed colors used by `subtheme` on `Button`/`Progress`/
   *   `Toast`. This is the common case: flagging a row (a failed job, a
   *   pending invoice) with the toolkit's existing semantic vocabulary
   *   instead of one-off colors.
   * - A `Partial<SubthemeColors>` slice — `{ background?, border?, color?
   *   }` (see `theme/subtheme.ts`) — for a custom row color the four
   *   presets don't cover. Only the fields you set are applied; a field
   *   left out falls back to that row's normal, unflagged appearance
   *   (default zebra background / border / text color) rather than to
   *   any preset. `resolveSubtheme(name)` returns this exact shape, so
   *   `rowSubtheme={(r) => ({ ...resolveSubtheme('warning'), border:
   *   myCustomBorder })}` composes a preset with a one-off override.
   *
   * Either form is applied to the row's background/border and to every
   * cell's text color in it, and disables that row's zebra-striping so
   * the color stays legible. Return `undefined` for a row that shouldn't
   * be styled.
   *
   * `index` is the row's position within the *current page* (matching
   * `rowKey`/`Column.render`'s `index`), not its position in the full
   * `data` array — it resets to `0` at the top of every page. When
   * `pagination` is false there's only one "page", so it's simply this
   * row's absolute index in the sorted dataset.
   */
  rowSubtheme?: (record: T, index: number) => SubthemeName | Partial<SubthemeColors> | undefined;
  /**
   * Called when a row is clicked. Every row click also emits
   * `datatable:row_clicked` on the event bus regardless of whether this is
   * given, so an AI agent observing the bus can see row interactions even
   * in apps that don't wire up their own handler — this prop is for the
   * app's own reaction (open a detail view, select the row, etc.). Rows
   * only show a pointer cursor when this is provided, so the visual
   * affordance matches what's actually clickable.
   */
  onRowClick?: (record: T, index: number) => void;
  /**
   * Controlled sort key. Pass a value (a column's `key`, or `null` for
   * unsorted) to drive sorting from parent state — e.g. to persist it in
   * a URL — instead of letting `<DataTable>` manage it internally. Omit
   * entirely for the common uncontrolled case; `defaultSortKey` seeds
   * that internal state instead.
   */
  sortKey?: string | null;
  /** Initial sort key when uncontrolled (`sortKey` omitted). */
  defaultSortKey?: string | null;
  /** Controlled sort direction. Only meaningful alongside `sortKey`. @default 'asc' */
  sortDirection?: 'asc' | 'desc';
  /** Initial sort direction when uncontrolled. @default 'asc' */
  defaultSortDirection?: 'asc' | 'desc';
  /**
   * Called whenever sort changes, whether controlled or uncontrolled —
   * mirrors `datatable:sorted`'s payload shape as direct props instead
   * of a bus subscription. `key` is `null` when the cycle lands back on
   * unsorted.
   */
  onSortChange?: (key: string | null, direction: 'asc' | 'desc') => void;
  /**
   * Controlled current page (1-indexed). Pass a value to drive paging
   * from parent state instead of letting `<DataTable>` manage it
   * internally. Omit for the common uncontrolled case; `defaultPage`
   * seeds that internal state instead. No effect when `pagination` is
   * false.
   */
  page?: number;
  /** Initial page when uncontrolled (`page` omitted). @default 1 */
  defaultPage?: number;
  /** Called whenever the page changes, whether controlled or uncontrolled. */
  onPageChange?: (page: number) => void;
  /**
   * Adds a checkbox selection column and a bulk-action bar. Greenfield —
   * there is no selection model on `<DataTable>` without this.
   * @default false
   */
  selectable?: boolean;
  /**
   * Controlled set of selected row keys (matching whatever `rowKey`
   * resolves to, stringified). Pass to drive selection from parent state
   * instead of letting `<DataTable>` manage it internally. Omit for the
   * common uncontrolled case; `defaultSelectedKeys` seeds that internal
   * state instead.
   *
   * Selection persists across pages — a `Set` of keys held regardless of
   * `page`, not reset per page — since "select N of M rows, filtered
   * across pages" is the realistic case a bulk-action bar exists for.
   * This is correct out of the box only with a real, stable `rowKey`
   * (e.g. `record => record.id`); the default index-based fallback key is
   * only unique *within the current dataset order*, so it survives simple
   * pagination but not a re-sort or a data mutation, the same inherent
   * limitation `rowKey`'s own index-based fallback already has elsewhere.
   */
  selectedKeys?: string[];
  /** Initial selected keys when uncontrolled (`selectedKeys` omitted). */
  defaultSelectedKeys?: string[];
  /** Called whenever selection changes, whether controlled or uncontrolled. */
  onSelectionChange?: (selectedKeys: string[]) => void;
  /**
   * Renders the action buttons in the bulk-action `<Toolbar>` that appears
   * once at least one row is selected — the selection-count label is
   * already provided; this renders only the actions themselves (e.g.
   * "Delete", "Export"), receiving the current selection to act on.
   */
  renderBulkActions?: (selectedKeys: string[]) => ReactNode;
  /** Per-instance overrides for density, border style, and striping. */
  overrides?: Partial<TableSliceState>;
  /**
   * Rendered in place of the row set when there's nothing to show (the
   * sorted dataset is empty) — the header and, if `pagination` is true,
   * the pagination footer (correctly showing "0 of 0") still render
   * normally around it. Omit for the previous default: an empty `<tbody>`
   * with no message at all.
   */
  emptyState?: ReactNode;
}

/**
 * @manifest Virtualized, sortable, paginated data table with sticky headers and real WAI-ARIA grid keyboard navigation
 * @manifestCategory Data Display
 * @manifestAntiPatternAvoid Fake per-row emphasis via `column.render` (styling each cell individually to approximate a highlighted row), or hand-roll row selection (a `Set` of ids in parent state, a checkbox column, header indeterminate logic)
 * @manifestAntiPatternInstead Use `<DataTable rowSubtheme={(record) => ...}>` for row emphasis — classifies a row into `'error'`/`'success'`/`'warning'`/`'info'` and tints the actual row background/border, not a per-cell approximation — and `<DataTable selectable selectedKeys={...} onSelectionChange={...}>` for selection, where the checkbox column, 3-state header checkbox, and cross-page persistence all come built in
 */
export function DataTable<T extends Record<string, any> = Record<string, any>>({
  id: propId,
  data,
  columns,
  pagination = true,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [5, 10, 25, 50, 100],
  itemHeight = 44,
  containerHeight = 'auto',
  rowKey,
  rowSubtheme,
  onRowClick,
  sortKey: controlledSortKey,
  defaultSortKey,
  sortDirection: controlledSortDirection,
  defaultSortDirection,
  onSortChange,
  page: controlledPage,
  defaultPage,
  onPageChange,
  selectable = false,
  selectedKeys: controlledSelectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  renderBulkActions,
  overrides,
  emptyState,
}: DataTableProps<T>) {
  const id = useStableId(propId, 'datatable');
  const strings = useLocaleStrings().dataTable;
  const { vars } = useSliceOverrides(DataTableThemeSlice, overrides);
  // Row-level borders below are set directly in JS (not through
  // --ai-table-border, which only reaches the cells' borderRight — see that
  // usage further down), so a flagged row's dashed border needs its own
  // read of the effective borderStyle to respect `overrides={{ borderStyle:
  // 'none' }}` instead of always drawing a border regardless.
  const effectiveBorderStyle = overrides?.borderStyle ?? DataTableThemeSlice.defaultState.borderStyle;
  useInjectInteractionStyles();

  const { sortKey, sortDirection, sortedData, handleSort } = useTableSort({
    data,
    columns,
    sortKey: controlledSortKey,
    defaultSortKey,
    sortDirection: controlledSortDirection,
    defaultSortDirection,
    onSortChange,
    tableId: id,
  });

  const [pageSize, setPageSize] = useState(initialPageSize);
  // usePagination's own onPageChange closure runs synchronously inside
  // whatever event handler called goToPage — including the page-size
  // select's handler below, which changes pageSize and resets to page 1 in
  // the same event. `setPageSize` is async (doesn't update the `pageSize`
  // closure variable until the next render), so without this ref the emitted
  // `datatable:paginated` payload would report the *old* pageSize for that
  // one case. Kept in sync every render; the page-size handler additionally
  // writes it synchronously before calling goToPage, so it's always current
  // by the time onPageChange reads it, regardless of React's batching.
  const pageSizeRef = useRef(pageSize);
  // useLayoutEffect, not a bare assignment during render -- writing to a
  // ref during render is unsafe under React's stricter rules (a discarded/
  // aborted render attempt could write a value that never actually
  // commits). useLayoutEffect runs synchronously right after commit,
  // before the browser paints or any event handler can run, which is
  // early enough that "kept in sync every render" (this comment's own
  // original claim) still holds by the time any event handler reads it.
  useLayoutEffect(() => {
    pageSizeRef.current = pageSize;
  }, [pageSize]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { height: observedHeight } = useAdaptiveSize(bodyRef);

  // Pagination — page-index math shared with <Pagination> via the
  // usePagination hook (src/components/shared/usePagination.ts), so there's
  // exactly one page-clamping/controlled-state implementation, not two that
  // can drift. `paginatedData` below still short-circuits entirely when
  // `pagination` is false, same as before this hook existed — step 3's
  // virtualization then windows across the whole sorted array instead of
  // one page at a time.
  const { currentPage: validCurrentPage, totalPages, goToPage: paginationGoToPage } = usePagination({
    totalItems: sortedData.length,
    pageSize,
    page: controlledPage,
    defaultPage,
    onPageChange: page => {
      onPageChange?.(page);
      aiBus.emit('datatable:paginated', { id, page, pageSize: pageSizeRef.current });
    },
  });

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (validCurrentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, validCurrentPage, pageSize, pagination]);

  // Row selection. `pageOffset` is 0 when pagination is disabled
  // (`paginatedData` is already the full sorted array in that case, so its
  // own index is already dataset-absolute) and the current page's starting
  // offset otherwise -- used only for the index-based selection-key
  // fallback below, entirely separate from `rowKey`'s own existing
  // page-relative index contract (`actualIndex` in the row-render loop),
  // which this doesn't change.
  const pageOffset = pagination ? (validCurrentPage - 1) * pageSize : 0;

  const { selectedKeySet, getSelectionKey, toggleRowSelected, toggleSelectAllOnPage, allOnPageSelected, someOnPageSelected } =
    useTableSelection({
      selectable,
      selectedKeys: controlledSelectedKeys,
      defaultSelectedKeys,
      onSelectionChange,
      tableId: id,
      rowKey,
      pageOffset,
      currentPageRecords: paginatedData,
    });

  const totalItems = paginatedData.length;

  const { startIndex, endIndex, isAutoHeight, onScroll } = useTableVirtualization({
    bodyRef,
    itemHeight,
    containerHeight,
    observedHeight,
    totalItems,
    // Changing page, page size, or sort reorders/reslices the dataset the
    // same way -- the virtualization window has to reset for all three, not
    // just page changes, or a scroll offset left over from a differently-
    // sized page/sort order can render as an apparently empty table.
    resetKey: `${validCurrentPage}|${pageSize}|${sortKey}|${sortDirection}`,
  });

  const visibleRows = paginatedData.slice(startIndex, endIndex);

  // Grid coordinate layout: column 0 is the selection checkbox column when
  // `selectable`, otherwise column indices start directly at `columns`;
  // row 0 is always the header row, rows 1..paginatedData.length are body
  // rows (page-relative, matching `actualIndex + 1`).
  const colOffset = selectable ? 1 : 0;
  const gridColumnCount = columns.length + colOffset;
  const tableRef = useRef<HTMLTableElement>(null);
  const { focusedRow, focusedCol, handleKeyDown, handleFocus } = useTableKeyboardNav({
    tableRef,
    bodyRef,
    columnCount: gridColumnCount,
    pageRowCount: paginatedData.length,
    itemHeight,
    startIndex,
    endIndex,
  });
  const isFocusedCell = (row: number, col: number) => focusedRow === row && focusedCol === col;

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
        minHeight: isAutoHeight ? `${AUTO_HEIGHT_FALLBACK_PX}px` : 0,
        ...vars,
      }}
    >
      {/* Bulk Action Bar — appears once at least one row is selected, across any page. */}
      {selectable && selectedKeySet.size > 0 && (
        <div style={{ borderBottom: '0.0625rem solid var(--ai-border, #e5e7eb)', flex: '0 0 auto' }}>
          <Toolbar>
            <Toolbar.Left>
              <span style={{ fontSize: '0.875rem', fontWeight: 'var(--ai-font-weight-semibold, 600)', color: 'var(--ai-text-primary, #111827)' }}>
                {selectedKeySet.size} selected
              </span>
            </Toolbar.Left>
            <Toolbar.Right>{renderBulkActions?.(Array.from(selectedKeySet))}</Toolbar.Right>
          </Toolbar>
        </div>
      )}

      {/* Scrollable Virtualized Body (Fills parent flex box when containerHeight="auto") */}
      <div
        ref={bodyRef}
        onScroll={onScroll}
        // Focusable so a keyboard-only user can reach and scroll this region
        // directly (axe: scrollable-region-focusable) -- row-level controls
        // (checkboxes, sort buttons) don't cover this on their own since a
        // table with more rows than fit can still have unreached scroll
        // distance beyond the last focusable row.
        tabIndex={0}
        style={{
          height: typeof containerHeight === 'number' ? `${containerHeight}px` : undefined,
          flex: isAutoHeight ? '1 1 0px' : undefined,
          // Deliberately NOT AUTO_HEIGHT_FALLBACK_PX here, even in auto-height
          // mode — always a true `0`. This div's own min-height used to carry
          // the same 350px floor as the outer wrapper below, which meant it
          // competed for space independently of the bulk-action bar/pagination
          // footer's own needs: whenever the outer wrapper's real rendered
          // size landed at (or near) that 350px floor itself — an entirely
          // normal amount of real screen space, not just a contrived edge
          // case — this div still demanded a *full* 350px on top of whatever
          // the footer needed, so the combined content overflowed the outer
          // wrapper's own box and the footer (last in DOM order) got clipped
          // by its `overflow: hidden`, cut off outside the visible area
          // rather than shrinking gracefully. Confirmed via a real browser
          // run, computed heights inspected at every ancestor level. The
          // outer wrapper's own min-height (below) is the single place the
          // floor is enforced now — bulk bar and footer both already carry
          // `flex: '0 0 auto'` (never shrink below their natural size), so
          // this scroll body is the only participant left to absorb whatever
          // height the floor leaves over, however little that ends up being,
          // rather than fighting the footer for space it doesn't actually have.
          minHeight: 0,
          overflowY: 'auto',
          position: 'relative',
          width: '100%',
          // Every scroll frame and every sort/page/rowSubtheme change
          // rewrites this whole virtualized row set — containment scopes
          // that reflow/repaint to this box instead of the rest of the
          // page. Safe with the sticky <thead> below: sticky positioning
          // is computed against this element as the nearest scrolling
          // ancestor either way, which containment doesn't change (that's
          // a distinct mechanism from the containing-block-for-fixed/
          // absolute-descendants part of `contain`, which nothing in this
          // table relies on).
          contain: 'content',
        }}
      >
        <table
          ref={tableRef}
          role="grid"
          // Reflects the FULL dataset (not just the current virtualization
          // window, and per the W3C APG's own guidance for aria-rowcount --
          // https://www.w3.org/WAI/ARIA/apg/patterns/grid/ -- explicitly
          // including pagination as a case where not all rows are in the
          // DOM), +1 for the header row. aria-colcount is always the real
          // column count since, unlike rows, columns are never virtualized
          // -- every column is always present in the DOM, so aria-colindex
          // per cell isn't needed (the spec only calls for it when the DOM
          // column set is a subset of the full one).
          aria-rowcount={1 + sortedData.length}
          aria-colcount={gridColumnCount}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          style={{
            width: '100%',
            tableLayout: 'fixed',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '0.875rem',
          }}
        >
          <colgroup>
            {selectable && <col style={{ width: '2.75rem' }} />}
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
            <tr aria-rowindex={1}>
              {selectable && (
                <th style={{ padding: 'var(--ai-table-header-padding, var(--ai-padding-md, 0.75rem 1rem))', width: '2.75rem' }}>
                  <CheckboxPrimitive.Root
                    checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleSelectAllOnPage}
                    aria-label="Select all rows on this page"
                    className="ai-focus-ring"
                    data-grid-row={0}
                    data-grid-col={0}
                    tabIndex={isFocusedCell(0, 0) ? 0 : -1}
                    style={{
                      all: 'unset',
                      width: '1.125rem',
                      height: '1.125rem',
                      borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                      border: `0.0625rem solid ${allOnPageSelected || someOnPageSelected ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)'}`,
                      background: allOnPageSelected || someOnPageSelected ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-bg-surface, #ffffff)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                  >
                    <CheckboxPrimitive.Indicator
                      style={{ color: 'var(--ai-color-primary-text, #ffffff)', fontSize: '0.75rem', fontWeight: 'var(--ai-font-weight-black, 900)', display: 'flex' }}
                    >
                      {allOnPageSelected ? '✓' : '−'}
                    </CheckboxPrimitive.Indicator>
                  </CheckboxPrimitive.Root>
                </th>
              )}
              {columns.map((col, colIndex) => {
                const isSortable = col.sortable === true;
                const gridCol = colOffset + colIndex;
                return (
                  <th
                    key={col.key}
                    // Not itself part of the roving-tabindex/data-grid-*
                    // scheme when sortable -- the <button> below is the
                    // real focus target for that case (the APG's own
                    // "cell contains one widget" pattern), so this <th>
                    // only carries those attributes for a non-sortable
                    // column, where it's the cell target itself instead.
                    {...(!isSortable
                      ? { 'data-grid-row': 0, 'data-grid-col': gridCol, tabIndex: isFocusedCell(0, gridCol) ? 0 : -1 }
                      : {})}
                    className={!isSortable ? 'ai-focus-ring' : undefined}
                    aria-sort={
                      isSortable
                        ? sortKey === col.key
                          ? sortDirection === 'asc' ? 'ascending' : 'descending'
                          : 'none'
                        : undefined
                    }
                    style={{
                      // Padding moves onto the <button> below for a sortable
                      // column (padding: 0 here) -- see that element's own
                      // comment on why.
                      padding: isSortable
                        ? 0
                        : 'var(--ai-table-header-padding, var(--ai-padding-md, 0.75rem 1rem))',
                      fontWeight: 'var(--ai-font-weight-semibold, 600)',
                      color: 'var(--ai-text-primary, #111827)',
                      cursor: isSortable ? undefined : 'default',
                      // A percentage height on the button below only
                      // resolves against a <th> with an explicit height of
                      // its own, not just whatever height the table's row
                      // algorithm happens to stretch it to -- without this,
                      // the button could stay at its own auto content
                      // height inside a <th> a taller sibling column
                      // stretched, leaving unclickable dead space.
                      height: isSortable ? '100%' : undefined,
                      width: col.width,
                    }}
                  >
                    {isSortable ? (
                      // A real <button> here (rather than the <th> itself
                      // carrying tabIndex/onKeyDown) gets native focusability
                      // and Enter/Space activation for free, and is
                      // announced by a screen reader as an actual button
                      // instead of relying on aria-sort alone to signal
                      // that a plain-looking header is interactive -- the
                      // WAI-ARIA sortable-table pattern's own recommended
                      // shape. aria-sort stays on the <th>, where the
                      // pattern expects it. The header padding lives on the
                      // button (not the <th>, which is padding: 0 above)
                      // and the button is width: 100% + border-box, so the
                      // whole cell stays clickable, not just the text/arrow
                      // -- matching the click target the plain <th> gave
                      // before this was a <button> at all.
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className="ai-focus-ring"
                        data-grid-row={0}
                        data-grid-col={gridCol}
                        tabIndex={isFocusedCell(0, gridCol) ? 0 : -1}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                          // height: 100% matters whenever this <th> shares
                          // its row with a taller one (a longer title that
                          // wraps, e.g.) -- table cells in the same row
                          // always stretch to the row's tallest cell, so
                          // without this the button would leave dead
                          // (unclickable) space above/below it inside a
                          // <th> taller than the button's own content.
                          width: '100%',
                          height: '100%',
                          boxSizing: 'border-box',
                          padding: 'var(--ai-table-header-padding, var(--ai-padding-md, 0.75rem 1rem))',
                          cursor: 'pointer',
                          userSelect: 'none',
                          background: 'none',
                          border: 'none',
                          font: 'inherit',
                          color: 'inherit',
                          textAlign: 'left',
                        }}
                      >
                        {col.title}
                        {sortKey === col.key && (
                          // aria-sort on the <th> above already conveys sort
                          // direction programmatically -- without
                          // aria-hidden, a screen reader also announces
                          // this character literally ("black up-pointing
                          // triangle"), redundant and confusing next to
                          // that.
                          <span aria-hidden="true">{sortDirection === 'asc' ? '▲' : '▼'}</span>
                        )}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        {col.title}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sortedData.length === 0 && emptyState ? (
              // Header and (if pagination is on) the footer's own "0 of 0"
              // text already render normally around this -- only the row
              // area itself needs a stand-in. A single colSpan-ed row (not
              // replacing the whole <table>) keeps that header visible,
              // matching what a real user needs to see (sortable columns,
              // selection controls) even while there's nothing to act on.
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                  {emptyState}
                </td>
              </tr>
            ) : (
              <>
                {/* Virtual Spacer Top -- pure layout padding, not a real
                    grid row, so it's excluded from the accessible row
                    model entirely rather than getting its own
                    aria-rowindex. */}
                {startIndex > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={columns.length + (selectable ? 1 : 0)} style={{ height: `${startIndex * itemHeight}px`, padding: 0 }} />
                  </tr>
                )}

                {/* Visible Rows */}
                {visibleRows.map((record, relativeIndex) => {
                  const actualIndex = startIndex + relativeIndex;
                  const key = rowKey ? rowKey(record, actualIndex) : actualIndex;
                  const subtheme = rowSubtheme?.(record, actualIndex);
                  const subthemeColors: Partial<SubthemeColors> | null =
                    typeof subtheme === 'string' ? resolveSubtheme(subtheme) : subtheme ?? null;
                  const selectionKey = selectable ? getSelectionKey(record, actualIndex) : null;
                  const isRowSelected = selectionKey !== null && selectedKeySet.has(selectionKey);
                  const gridRow = actualIndex + 1;
                  return (
                    <tr
                      key={key}
                      // +2: 1-based, plus the header row -- see the
                      // <table>'s own aria-rowcount comment on why this
                      // reflects the row's position across the whole
                      // dataset (pageOffset), not just the current page.
                      aria-rowindex={pageOffset + actualIndex + 2}
                      onClick={() => {
                        onRowClick?.(record, actualIndex);
                        aiBus.emit('datatable:row_clicked', { id, index: actualIndex });
                      }}
                      style={{
                        height: `${itemHeight}px`,
                        cursor: onRowClick ? 'pointer' : undefined,
                        borderBottom: subthemeColors?.border
                          ? effectiveBorderStyle === 'none'
                            ? 'none'
                            : `0.0625rem dashed ${subthemeColors.border}`
                          : '0.0625rem solid var(--ai-border, #f3f4f6)',
                        background: isRowSelected
                          ? 'var(--ai-subtheme-info-bg, rgba(59, 130, 246, 0.08))'
                          : subthemeColors?.background
                          ? subthemeColors.background
                          : actualIndex % 2 === 0 ? 'transparent' : 'var(--ai-table-stripe-bg, var(--ai-bg-container, #f9fafb))',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {selectable && selectionKey !== null && (
                        <td
                          style={{ padding: 'var(--ai-table-cell-padding, var(--ai-padding-sm, 0.5rem 1rem))' }}
                          onClick={e => e.stopPropagation()}
                        >
                          <CheckboxPrimitive.Root
                            checked={isRowSelected}
                            onCheckedChange={() => toggleRowSelected(selectionKey)}
                            aria-label={`Select row ${actualIndex + 1}`}
                            className="ai-focus-ring"
                            data-grid-row={gridRow}
                            data-grid-col={0}
                            tabIndex={isFocusedCell(gridRow, 0) ? 0 : -1}
                            style={{
                              all: 'unset',
                              width: '1.125rem',
                              height: '1.125rem',
                              borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                              border: `0.0625rem solid ${isRowSelected ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)'}`,
                              background: isRowSelected ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-bg-surface, #ffffff)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              boxSizing: 'border-box',
                            }}
                          >
                            <CheckboxPrimitive.Indicator
                              style={{ color: 'var(--ai-color-primary-text, #ffffff)', fontSize: '0.75rem', fontWeight: 'var(--ai-font-weight-black, 900)', display: 'flex' }}
                            >
                              ✓
                            </CheckboxPrimitive.Indicator>
                          </CheckboxPrimitive.Root>
                        </td>
                      )}
                      {columns.map((col, colIndex) => {
                        const value = col.accessorFn ? col.accessorFn(record) : record[col.key];
                        const gridCol = colOffset + colIndex;
                        return (
                          <td
                            key={col.key}
                            // Roving-tabindex target for every data cell,
                            // uniformly -- including a column with a custom
                            // `render`. See useTableKeyboardNav's own header
                            // comment for why this deliberately does not try
                            // to detect/land on an interactive element a
                            // custom render might contain: that content is
                            // still reachable, just via native Tab order
                            // rather than being folded into the grid's
                            // single-composite-widget model.
                            data-grid-row={gridRow}
                            data-grid-col={gridCol}
                            tabIndex={isFocusedCell(gridRow, gridCol) ? 0 : -1}
                            className="ai-focus-ring"
                            style={{
                              padding: 'var(--ai-table-cell-padding, var(--ai-padding-sm, 0.5rem 1rem))',
                              color: subthemeColors?.color ?? 'var(--ai-text-primary, #111827)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              borderRight: 'var(--ai-table-border, none)',
                            }}
                          >
                            {col.render ? col.render({ value, row: record, index: actualIndex }) : String(value ?? '')}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Virtual Spacer Bottom -- same reasoning as the top spacer. */}
                {endIndex < totalItems && (
                  <tr aria-hidden="true">
                    <td colSpan={columns.length + (selectable ? 1 : 0)} style={{ height: `${(totalItems - endIndex) * itemHeight}px`, padding: 0 }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer — omitted entirely when `pagination` is false,
          since there's no page concept to show controls for; the table
          above is already virtualizing across the full dataset in that
          mode. */}
      {pagination && (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--ai-padding-md, 0.625rem 1rem)',
          borderTop: '0.0625rem solid var(--ai-border, #e5e7eb)',
          background: 'var(--ai-bg-container, #f9fafb)',
          fontSize: '0.875rem',
          flex: '0 0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <div role="status" aria-live="polite" aria-atomic="true" style={{ color: 'var(--ai-text-secondary, #6b7280)' }}>
          {strings.showingEntries(
            totalItems > 0 ? (validCurrentPage - 1) * pageSize + 1 : 0,
            Math.min(validCurrentPage * pageSize, sortedData.length),
            sortedData.length
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <UIGroup>
            <select
              aria-label={strings.rowsPerPage}
              value={pageSize}
              onChange={e => {
                const newSize = Number(e.target.value);
                // Write the ref before setPageSize/goToPage -- see
                // pageSizeRef's own comment on why: goToPage's onPageChange
                // callback runs synchronously, before setPageSize's async
                // update reaches the `pageSize` closure variable.
                pageSizeRef.current = newSize;
                setPageSize(newSize);
                paginationGoToPage(1);
              }}
              className="ai-btn"
              style={{
                padding: 'var(--ai-padding-xs, 0.25rem 0.5rem)',
                border: '0.0625rem solid var(--ai-border, #d1d5db)',
                background: 'var(--ai-bg-surface, #ffffff)',
                color: 'var(--ai-text-primary, #111827)',
                fontSize: '0.75rem',
                cursor: 'pointer',
                ['--ai-btn-bg' as string]: 'var(--ai-bg-surface, #ffffff)',
              }}
            >
              {pageSizeOptions.map(opt => (
                <option key={opt} value={opt}>
                  {strings.perPageOption(opt)}
                </option>
              ))}
            </select>

            <button
              onClick={() => paginationGoToPage(validCurrentPage - 1)}
              disabled={validCurrentPage === 1}
              aria-label={strings.previousPage}
              className="ai-btn"
              style={{
                padding: 'var(--ai-padding-xs, 0.25rem 0.5rem)',
                border: '0.0625rem solid var(--ai-border, #d1d5db)',
                background: 'var(--ai-bg-surface, #ffffff)',
                color: 'var(--ai-text-primary, #111827)',
                fontSize: '0.75rem',
                cursor: validCurrentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: validCurrentPage === 1 ? 0.5 : 1,
                ['--ai-btn-bg' as string]: 'var(--ai-bg-surface, #ffffff)',
              }}
            >
              ◀
            </button>

            <span
              style={{
                padding: 'var(--ai-padding-xs, 0.25rem 0.5rem)',
                border: '0.0625rem solid var(--ai-border, #d1d5db)',
                background: 'var(--ai-bg-surface, #ffffff)',
                fontSize: '0.75rem',
                fontWeight: 'var(--ai-font-weight-semibold, 600)',
                color: 'var(--ai-text-primary, #111827)',
              }}
            >
              {validCurrentPage} / {totalPages}
            </span>

            <button
              onClick={() => paginationGoToPage(validCurrentPage + 1)}
              disabled={validCurrentPage === totalPages}
              aria-label={strings.nextPage}
              className="ai-btn"
              style={{
                padding: 'var(--ai-padding-xs, 0.25rem 0.5rem)',
                border: '0.0625rem solid var(--ai-border, #d1d5db)',
                background: 'var(--ai-bg-surface, #ffffff)',
                color: 'var(--ai-text-primary, #111827)',
                fontSize: '0.75rem',
                cursor: validCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: validCurrentPage === totalPages ? 0.5 : 1,
                ['--ai-btn-bg' as string]: 'var(--ai-bg-surface, #ffffff)',
              }}
            >
              ▶
            </button>
          </UIGroup>
        </div>
      </div>
      )}
    </div>
  );
}
