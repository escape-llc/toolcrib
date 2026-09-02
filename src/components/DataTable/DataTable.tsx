import React, { useState, useMemo, useRef, useEffect, type ReactNode } from 'react';
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
}

/**
 * @manifest Virtualized, sortable, paginated data table with sticky headers
 * @manifestCategory Data Display
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

  // Sort and page each follow the same controlled/uncontrolled split as
  // TabStrip's activeId: a prop of `undefined` means "manage it
  // internally" (seeded from the matching `default*` prop), anything else
  // means the parent owns that state and this component only ever reads
  // it back through the resolved `sortKey`/`currentPage` below.
  const [internalSortKey, setInternalSortKey] = useState<string | null>(defaultSortKey ?? null);
  const [internalSortDirection, setInternalSortDirection] = useState<'asc' | 'desc'>(defaultSortDirection ?? 'asc');
  const isSortControlled = controlledSortKey !== undefined;
  const sortKey = isSortControlled ? controlledSortKey : internalSortKey;
  const sortDirection = isSortControlled ? controlledSortDirection ?? 'asc' : internalSortDirection;

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
  pageSizeRef.current = pageSize;
  const [scrollTop, setScrollTop] = useState(0);

  const bodyRef = useRef<HTMLDivElement>(null);
  const { height: observedHeight } = useAdaptiveSize(bodyRef);

  // Scroll events are throttled to one setScrollTop per animation frame (see
  // onScroll below) via these two refs.
  const latestScrollTopRef = useRef(0);
  const scrollRafRef = useRef<number | null>(null);

  // 1. Sorting
  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    // A column with `accessorFn` sorts by its computed value instead of a
    // direct `record[sortKey]` read — the same function that produces its
    // cell value.
    const sortColumn = columns.find(c => c.key === sortKey);
    const getValue = (record: T): unknown => (sortColumn?.accessorFn ? sortColumn.accessorFn(record) : record[sortKey]);
    return [...data].sort((a, b) => {
      const valA = getValue(a);
      const valB = getValue(b);
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        // A NaN operand makes `valA - valB` itself NaN, which
        // Array.prototype.sort treats as an unspecified (non-crashing but
        // effectively unsorted) comparison result — sort NaN to the end,
        // the same place `null`/`undefined` land above, rather than
        // leaving its position undefined.
        if (Number.isNaN(valA) && Number.isNaN(valB)) return 0;
        if (Number.isNaN(valA)) return 1;
        if (Number.isNaN(valB)) return -1;
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDirection, columns]);

  // 2. Pagination — page-index math shared with <Pagination> via the
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

  // Nothing previously reset scrollTop (state or the real DOM scroll
  // position) when the page changed — scrolling deep into page 1, then
  // paging forward, left the virtualization window (startIndex/endIndex
  // below) computed from a scroll offset that belonged to a completely
  // different page's row count, which could render as an apparently empty
  // table until the user manually scrolled back up. Sorting reorders the
  // current page's rows exactly the same way pagination does, so it has to
  // reset the window too — sortKey/sortDirection are included below for
  // that reason, not left out as an oversight.
  //
  // Also cancels any in-flight scroll rAF and clears latestScrollTopRef:
  // without this, a scroll on the *old* page that was still waiting for its
  // throttled frame when the page/sort changed would fire after this reset,
  // calling setScrollTop with the stale pre-change offset and silently
  // undoing the reset above — reintroducing the exact blank-table bug this
  // effect exists to prevent.
  useEffect(() => {
    if (scrollRafRef.current !== null) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
    }
    latestScrollTopRef.current = 0;
    setScrollTop(0);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [validCurrentPage, pageSize, sortKey, sortDirection]);

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
  const getSelectionKey = (record: T, pageRelativeIndex: number): string =>
    rowKey ? String(rowKey(record, pageRelativeIndex)) : String(pageOffset + pageRelativeIndex);

  const [internalSelectedKeys, setInternalSelectedKeys] = useState<Set<string>>(
    () => new Set(defaultSelectedKeys ?? [])
  );
  const isSelectionControlled = controlledSelectedKeys !== undefined;
  const selectedKeySet = isSelectionControlled ? new Set(controlledSelectedKeys) : internalSelectedKeys;

  const updateSelection = (next: Set<string>) => {
    if (!isSelectionControlled) setInternalSelectedKeys(next);
    const arr = Array.from(next);
    onSelectionChange?.(arr);
    aiBus.emit('datatable:selection_changed', { id, selectedKeys: arr });
  };

  const toggleRowSelected = (key: string) => {
    const next = new Set(selectedKeySet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    updateSelection(next);
  };

  // Scoped to the *current page* only, per the doc's own spec -- "some but
  // not all of the current page selected" -- even though `selectedKeySet`
  // itself holds keys from any page (selection persists across pages).
  const currentPageKeys = useMemo(
    () => (selectable ? paginatedData.map((record, i) => getSelectionKey(record, i)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectable, paginatedData, rowKey, pageOffset]
  );
  const allOnPageSelected = selectable && currentPageKeys.length > 0 && currentPageKeys.every(k => selectedKeySet.has(k));
  const someOnPageSelected = selectable && !allOnPageSelected && currentPageKeys.some(k => selectedKeySet.has(k));

  const toggleSelectAllOnPage = () => {
    const next = new Set(selectedKeySet);
    if (allOnPageSelected) currentPageKeys.forEach(k => next.delete(k));
    else currentPageKeys.forEach(k => next.add(k));
    updateSelection(next);
  };

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
    let newKey: string | null;
    let newDirection: 'asc' | 'desc';
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        newKey = key;
        newDirection = 'desc';
      } else {
        newKey = null;
        newDirection = sortDirection;
      }
    } else {
      newKey = key;
      newDirection = 'asc';
    }
    if (!isSortControlled) {
      setInternalSortKey(newKey);
      setInternalSortDirection(newDirection);
    }
    onSortChange?.(newKey, newDirection);
    aiBus.emit('datatable:sorted', { id, key: newKey, direction: newDirection });
  };

  // Raw scroll events can fire far faster than one per frame; setting
  // scrollTop straight from each one re-runs the virtualization math (and
  // rowSubtheme/resolveSubtheme for every visible row) that often too.
  // Coalescing to one update per animation frame — keeping only the latest
  // offset via the ref — cuts that to the rate the browser can actually
  // paint at. (latestScrollTopRef/scrollRafRef are declared up with
  // bodyRef, not here, so the page/sort-change reset effect above can
  // cancel an in-flight frame — see that effect's comment.)
  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    latestScrollTopRef.current = e.currentTarget.scrollTop;
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      setScrollTop(latestScrollTopRef.current);
    });
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
            <tr>
              {selectable && (
                <th style={{ padding: 'var(--ai-table-header-padding, var(--ai-padding-md, 0.75rem 1rem))', width: '2.75rem' }}>
                  <CheckboxPrimitive.Root
                    checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleSelectAllOnPage}
                    aria-label="Select all rows on this page"
                    className="ai-focus-ring"
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
              {columns.map(col => {
                const isSortable = col.sortable === true;
                return (
                  <th
                    key={col.key}
                    onClick={() => isSortable && handleSort(col.key)}
                    onKeyDown={e => {
                      if (!isSortable) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSort(col.key);
                      }
                    }}
                    tabIndex={isSortable ? 0 : undefined}
                    className={isSortable ? 'ai-focus-ring' : undefined}
                    aria-sort={
                      isSortable
                        ? sortKey === col.key
                          ? sortDirection === 'asc' ? 'ascending' : 'descending'
                          : 'none'
                        : undefined
                    }
                    style={{
                      padding: 'var(--ai-table-header-padding, var(--ai-padding-md, 0.75rem 1rem))',
                      fontWeight: 'var(--ai-font-weight-semibold, 600)',
                      color: 'var(--ai-text-primary, #111827)',
                      cursor: isSortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      width: col.width,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      {col.title}
                      {isSortable && sortKey === col.key && (
                        <span>{sortDirection === 'asc' ? '▲' : '▼'}</span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Virtual Spacer Top */}
          <tbody>
            {startIndex > 0 && (
              <tr>
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
              return (
                <tr
                  key={key}
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
                  {columns.map(col => {
                    const value = col.accessorFn ? col.accessorFn(record) : record[col.key];
                    return (
                      <td
                        key={col.key}
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

            {/* Virtual Spacer Bottom */}
            {endIndex < totalItems && (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} style={{ height: `${(totalItems - endIndex) * itemHeight}px`, padding: 0 }} />
              </tr>
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
