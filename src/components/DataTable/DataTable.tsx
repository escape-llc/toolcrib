'use client';

import {
  useMemo,
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  type ReactNode,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Checkbox as CheckboxPrimitive, DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { UIGroup } from '../UIGroup/UIGroup';
import { Button } from '../Form/FormComponents';
import { VisuallyHidden } from '../Layout/VisuallyHidden';
import { Toolbar } from '../Toolbar/Toolbar';
import { Z_INDEX } from '../../theme/zIndex';
import { useAdaptiveSize } from '../../observer/useAdaptiveSize';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { resolveSubtheme, type SubthemeName, type SubthemeColors } from '../../theme/subtheme';
import { useStableId } from '../shared/useStableId';
import { usePagination } from '../shared/usePagination';
import { aiBus } from '../../eventBus/eventBus';
import { DataTableThemeSlice, type TableSliceState, type TableDensity, DENSITY_ROW_HEIGHT_PX } from './DataTableSlice';
import { columnsToCsv, downloadCsvFile } from './csvExport';
import { useLocaleStrings } from '../Locale/LocaleContext';
import { useTableSort } from './useTableSort';
import { useTableQuickFilter } from './useTableQuickFilter';
import { useTableDensity } from './useTableDensity';
import { useTableSelection } from './useTableSelection';
import { useTableVirtualization, AUTO_HEIGHT_FALLBACK_PX } from './useTableVirtualization';
import { useTableKeyboardNav } from './useTableKeyboardNav';
import { useTableColumnResize } from './useTableColumnResize';
import { useTableColumnVisibility } from './useTableColumnVisibility';
import { useTableColumnPinning } from './useTableColumnPinning';
import { useTargetDocument } from '../../theme/targetDocumentContext';

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
  /**
   * If true, shows a drag handle on this column's trailing edge, resizable
   * by mouse/touch or (with the handle focused) Left/Right arrow keys
   * (Shift for a bigger step), Home (minimum), and End. Works regardless
   * of whether `width` above is set, a CSS string, or omitted entirely --
   * a drag measures this column's own real rendered width as its starting
   * point rather than requiring a pre-declared pixel value. @default false
   */
  resizable?: boolean;
  /**
   * Minimum width (px) a drag or arrow-key resize can shrink this column
   * to -- prevents a variant of the real `table-layout: fixed`
   * column-collapse defect documented in this project's own competitive
   * research. Only meaningful alongside `resizable`.
   * @default 40
   */
  minWidth?: number;
  /**
   * Freezes this column at the left or right edge of the scrollable grid
   * body, staying visible (via CSS `position: sticky`) while the user
   * scrolls the rest of the columns horizontally underneath it -- the same
   * mechanism `<DataTable>`'s own sticky header already uses, extended to
   * the horizontal axis (issue #341). Multiple columns can be pinned to the
   * same side; they stack in `columns` order (left-pinned) or reverse order
   * (right-pinned, so the last-declared right-pinned column sits flush
   * against the grid's own right edge). When `selectable` is on and at
   * least one column is pinned `'left'`, the selection checkbox/radio
   * column automatically pins alongside it too (there's no reason to freeze
   * a data column but let selection scroll away); the same applies to
   * `rowCommands`' trailing actions column whenever any column is pinned
   * `'right'`.
   */
  pinned?: 'left' | 'right';
}

/** One column's priority within a multi-column sort -- see `DataTableProps.sortBy` (issue #337). */
export interface SortDescriptor {
  key: string;
  direction: 'asc' | 'desc';
}

/** One action button rendered per row in `<DataTable rowCommands>`'s trailing actions column. */
export interface RowCommand<T = any> {
  /** Stable id for this action -- becomes `command` in the `datatable:row_command` event emitted on click. */
  id: string;
  /** Visible label -- also the button's `aria-label`, since the rendered button is icon-only when `icon` is given. */
  label: string;
  /** Optional leading icon/glyph shown instead of the text label (the label still becomes `aria-label`/`title`). */
  icon?: string;
  /** Omit this specific command for a given row (e.g. hide "Delete" for a protected record) -- returning false skips rendering the button entirely, not just disables it. */
  isVisible?: (record: T, index: number) => boolean;
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
   * `defaultPageSize`/`pageSizeOptions` are ignored in this mode.
   * @default true
   */
  pagination?: boolean;
  /**
   * Called once whenever the virtualization window's own trailing edge
   * comes within `endReachedThreshold` rows of the end of `data` -- the
   * signal a `pagination={false}` (continuous-scroll) consumer needs to
   * lazy-load more rows from a server as the user scrolls near the end of
   * what's currently loaded (issue #365). The actual continuous-scroll
   * rendering/windowing needs no help from this -- `pagination={false}`
   * already virtualizes across the whole `data` array with no page
   * boundaries; this is purely an early-warning callback layered on top.
   *
   * Fires at most once per distinct `data.length` -- appending more rows
   * (growing `data`) re-arms it for the next threshold crossing;
   * scrolling back and forth within the same loaded set does not
   * re-trigger it. Has no effect when `pagination` is true: a paginated
   * table already has a complete, known page of data and Prev/Next
   * navigation, so "near the end of the current page" isn't a signal to
   * load more from a server the way it is in continuous-scroll mode.
   * Also mirrored on the event bus as `datatable:end_reached`.
   */
  onEndReached?: () => void;
  /**
   * How many rows from the end of `data` the virtualization window's
   * trailing edge must come within before `onEndReached` fires. Only
   * meaningful alongside `onEndReached`.
   * @default 10
   */
  endReachedThreshold?: number;
  /**
   * Initial number of rows per page. Named `default*` (issue #391 --
   * renamed from the original `pageSize`) because that's exactly its
   * contract: it seeds this table's internal page-size state once, the
   * same uncontrolled-initial-value shape `defaultPage`/`defaultSortBy`/
   * `defaultSelectedKeys`/`defaultQuickFilterValue`/`defaultColumnWidths`/
   * `defaultDensity` all already use elsewhere in this component -- a
   * later change to this prop's own value does NOT propagate; there is no
   * live-syncing "controlled" counterpart for page size the way `page`
   * itself has one. `'auto'` computes it live instead of using a fixed
   * number -- `Math.floor(<measured body height> / itemHeight)` -- so a
   * page always fills exactly the space it's given (no partial row cut
   * off, no empty space at the bottom), recomputing whenever the container
   * is resized or density changes `itemHeight`. Mirrors `containerHeight`'s
   * own `'auto'` convention, and reuses the exact same live measurement
   * (`useAdaptiveSize(bodyRef)`) that already drives it.
   *
   * Also the default (issue #419) -- an AI (or a human) reaching for
   * `<DataTable>` with no opinion at all about page size gets a page that
   * already fills its own container exactly, rather than an arbitrary
   * fixed 10 that might leave half the available space empty or cut a row
   * off. `'Auto'` is also always present as a real option in the
   * page-size dropdown (alongside `pageSizeOptions`, not instead of it) --
   * an end user can switch the table into or out of auto-sizing
   * interactively; this prop only controls which one is selected first.
   * @default 'auto'
   */
  defaultPageSize?: number | 'auto';
  /**
   * Options shown in the page-size dropdown, alongside the always-present
   * "Auto" choice.
   * @default [5, 10, 25, 50, 100]
   */
  pageSizeOptions?: number[];
  /**
   * Height of each row in pixels (used for virtualization calculations).
   * Left unset, this is derived from the active density instead of a fixed
   * number -- `36`/`44`/`56` for compact/normal/spacious respectively
   * (`DataTableSlice.ts`'s own `DENSITY_ROW_HEIGHT_PX`, the same values its
   * `--ai-table-row-height` CSS variable is computed from) -- so switching
   * density doesn't leave the real virtualization window measuring against
   * stale numbers (issue #339). An explicit value here always wins over
   * that derivation.
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
   * Renders a global/quick-filter search box above the table -- a simple
   * case-insensitive substring match against every column's *resolved*
   * value (`Column.accessorFn(record)` if given, else
   * `record[Column.key]`; see `quickFilterValue`'s own doc for why this
   * is the resolved value rather than a `Column.render`'s rendered
   * output). Filtering happens before sorting/pagination/virtualization,
   * so `aria-rowcount`, the "Showing X to Y of Z" footer, and the
   * windowing math all already reflect the filtered count -- nothing
   * else needs to know filtering happened at all.
   * @default false
   */
  quickFilter?: boolean;
  /**
   * Restricts which columns `quickFilter` searches against, by `Column.key`
   * -- omit to search every column (the previous, only behavior). Doesn't
   * change where the search input itself is rendered (the built-in
   * `quickFilter` UI, or a consumer's own controlled `quickFilterValue`/
   * `onQuickFilterChange` input) -- only which columns get matched.
   */
  quickFilterFields?: ((keyof T & string) | (string & {}))[];
  /**
   * Controlled quick-filter value. Pass a value to drive it from parent
   * state (e.g. to persist it in a URL) instead of letting `<DataTable>`
   * manage it internally -- the same controlled/uncontrolled shape
   * `sortBy`/`page`/`selectedKeys` already use. Omit for the common
   * uncontrolled case; `defaultQuickFilterValue` seeds that internal
   * state instead. Has no effect when `quickFilter` is false.
   */
  quickFilterValue?: string;
  /** Initial quick-filter value when uncontrolled (`quickFilterValue` omitted). */
  defaultQuickFilterValue?: string;
  /**
   * Called whenever the quick-filter value changes, whether controlled or
   * uncontrolled -- mirrors `datatable:filtered`'s payload shape as a
   * direct prop instead of a bus subscription, the same relationship
   * `onSortChange` has to `datatable:sorted`. Changing the filter always
   * resets the current page back to 1 (matching the page-size dropdown's
   * own existing behavior) -- a page number valid for the old, larger
   * result set can easily be past the end of a smaller filtered one.
   */
  onQuickFilterChange?: (value: string) => void;
  /**
   * Controlled multi-column sort, in priority order (index 0 = primary
   * sort key). Pass an array to drive sorting from parent state — e.g. to
   * persist it in a URL — instead of letting `<DataTable>` manage it
   * internally. Omit entirely for the common uncontrolled case;
   * `defaultSortBy` seeds that internal state instead.
   *
   * A plain click on a sortable header replaces the WHOLE array with just
   * that one column -- the same asc -> desc -> unsorted cycle a
   * single-sort table always had, still true for the common case where
   * this never grows past one entry. Shift+click instead adds/cycles/
   * removes that column as the next sort PRIORITY without disturbing the
   * others, matching the Shift+click convention TanStack Table and AG
   * Grid both already use for their own free multi-sort.
   */
  sortBy?: SortDescriptor[];
  /** Initial multi-column sort when uncontrolled (`sortBy` omitted). */
  defaultSortBy?: SortDescriptor[];
  /**
   * Called whenever the sort changes, whether controlled or uncontrolled —
   * mirrors `datatable:sorted`'s payload shape as a direct prop instead of
   * a bus subscription.
   */
  onSortChange?: (sortBy: SortDescriptor[]) => void;
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
   * Adds a selection column and a bulk-action bar. Greenfield — there is
   * no selection model on `<DataTable>` without this. A row is also
   * selectable by clicking anywhere on it (see `disableRowClickSelection`)
   * — the checkbox/radio column is a redundant, always-available second
   * affordance for the exact same action, not the only way to select.
   * @default false
   */
  selectable?: boolean;
  /**
   * `'multiple'` (the default) renders checkboxes, a 3-state "select all"
   * header control, and lets a row click/Ctrl-click/Shift-click add to,
   * toggle, or range-select the current selection. `'single'` renders a
   * radio-style indicator instead, hides the "select all" control
   * (meaningless for one choice), and makes every selection action —
   * click, checkbox/radio, keyboard Space — simply replace the whole
   * selection with just that one row, matching real `<input
   * type="radio">` semantics (no modifier keys, no un-selecting by
   * re-clicking the current choice). `selectedKeys`/`onSelectionChange`
   * keep the same `string[]` shape either way, just constrained to 0 or 1
   * entries in `'single'` mode.
   * @default 'multiple'
   */
  selectionMode?: 'single' | 'multiple';
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
   * Set to disable click-to-select entirely, falling back to the
   * checkbox/radio column as the only way to change selection — for a
   * consumer whose `onRowClick` already does something unrelated to
   * selection (open a detail panel, navigate) and doesn't want a click
   * there to also select the row. Has no effect when `selectable` is
   * false. `onRowClick` itself always keeps firing on every row click
   * either way, per its own existing contract.
   * @default false
   */
  disableRowClickSelection?: boolean;
  /**
   * Hides the checkbox/radio column entirely while `selectable` stays in
   * effect — selection still works via row click (unless
   * `disableRowClickSelection`) and keyboard Space, this just removes the
   * visible per-row widget and the "select all" header control, for a
   * table that wants row-highlight-only selection with no dedicated
   * column taking up space. Every selected `<tr>` still carries
   * `aria-selected="true"` regardless of this flag, so the selection
   * state stays screen-reader-visible either way.
   * @default false
   */
  hideSelectionColumn?: boolean;
  /**
   * Renders the action buttons for the current selection, shown centered
   * in the same top toolbar row `quickFilter`/`densitySelector` share
   * (alongside the "N selected" count, already provided) once at least
   * one row is selected -- this renders only the actions themselves (e.g.
   * "Delete", "Export"), receiving the current selection to act on.
   */
  renderBulkActions?: (selectedKeys: string[]) => ReactNode;
  /**
   * Per-row action buttons rendered in a dedicated trailing column. Each
   * click emits `datatable:row_command` on `aiBus` (`{ id: <table id>,
   * command: <this RowCommand's own id>, key: <this row's resolved
   * selection/row key>, index }`) instead of requiring a bespoke callback
   * prop per action — an aiBus listener (an AI agent, an analytics
   * subscriber, anything else) reacts to "the user clicked Edit/Delete/
   * whatever on row N" the same generic way it already observes
   * `datatable:row_clicked`/`datatable:selection_changed`. Omit for no
   * actions column at all.
   */
  rowCommands?: RowCommand<T>[];
  /**
   * Controlled map of resized column widths (px), keyed by `Column.key`.
   * Only columns the user has actually resized need appear -- a column
   * absent from this map keeps rendering its own configured `width`. Pass
   * to drive resized widths from parent state (e.g. to persist them to
   * `localStorage`) instead of letting `<DataTable>` manage them
   * internally. Omit for the common uncontrolled case; `defaultColumnWidths`
   * seeds that internal state instead. Only meaningful for columns marked
   * `resizable`.
   */
  columnWidths?: Record<string, number>;
  /** Initial resized widths when uncontrolled (`columnWidths` omitted). */
  defaultColumnWidths?: Record<string, number>;
  /**
   * Called once a resize completes (mouse/touch release, or an
   * arrow-key/Home/End press), whether controlled or uncontrolled -- never
   * on every intermediate drag tick, so this is safe to wire straight to a
   * `localStorage` write without flooding it mid-drag.
   */
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  /** Per-instance overrides for density, border style, and striping. */
  overrides?: Partial<TableSliceState>;
  /**
   * Renders a built-in compact/normal/spacious toggle-button-group above
   * the table (in the same bar `quickFilter`'s search box occupies) that
   * drives density live -- both the CSS variables (padding/row height) and
   * the real row height virtualization measures against, together (issue
   * #339). Uses the `density`/`defaultDensity`/`onDensityChange` trio below
   * for its state, the same controlled/uncontrolled shape every other
   * `<DataTable>` feature already uses; enabling this without also passing
   * `density`/`defaultDensity` starts from `overrides.density` (if given)
   * or `'normal'`.
   * @default false
   */
  densitySelector?: boolean;
  /**
   * Controlled live density -- drives the actual applied density (both the
   * CSS variables and the real row height virtualization measures against)
   * from parent state, taking precedence over `overrides.density` when both
   * are given, since this represents an end user's own runtime choice
   * rather than a developer-set default. Pairs naturally with your own
   * external density UI when `densitySelector`'s built-in toggle group
   * isn't the right fit. Omit for the common uncontrolled case;
   * `defaultDensity` seeds that internal state instead. Passing neither
   * this, `defaultDensity`, nor `densitySelector` leaves density governed
   * entirely by `overrides.density` (or the theme's own default), exactly
   * as before this feature existed.
   */
  density?: TableDensity;
  /** Initial live density when uncontrolled (`density` omitted). Falls back to `overrides.density`, then `'normal'`. */
  defaultDensity?: TableDensity;
  /** Called whenever the live density changes, whether controlled or uncontrolled. */
  onDensityChange?: (density: TableDensity) => void;
  /**
   * Renders a built-in "Export CSV" button (in the same top toolbar row
   * `quickFilter`/`densitySelector` share) that downloads the *entire*
   * currently filtered + sorted dataset -- every matching row across every
   * page, not just the current page -- as a CSV file, using each column's
   * `title` as its header and the same resolved cell value
   * (`accessorFn(record)` if given, else `record[key]`) sorting already
   * uses. A column's custom `render` output is never used for the CSV,
   * since it can return arbitrary JSX with no meaningful plain-text form to
   * fall back on. Also emits `datatable:exported` on the event bus.
   * @default false
   */
  csvExport?: boolean;
  /**
   * File name for the CSV download triggered by `csvExport`.
   * @default 'export.csv'
   */
  csvExportFileName?: string;
  /**
   * Renders a built-in "Columns" button (same top toolbar row) that opens a
   * checklist menu letting an end user show/hide any column live -- every
   * column from `columns` is listed, regardless of its current visibility,
   * so a hidden column can always be re-shown from the same menu. A hidden
   * column occupies no grid position at all (not just a visually-hidden
   * one) -- it's skipped in the header, every body row, and CSV export
   * (`csvExport` above) alike, and keyboard-nav column coordinates stay
   * contiguous with no gap left behind. Uses the
   * `hiddenColumns`/`defaultHiddenColumns`/`onHiddenColumnsChange` trio
   * below for its state, the same controlled/uncontrolled shape every other
   * built-in `<DataTable>` feature already uses.
   * @default false
   */
  columnVisibility?: boolean;
  /**
   * Controlled set of hidden column keys (`Column.key`). Pass to drive
   * column visibility from parent state (e.g. to persist it to
   * `localStorage`) instead of letting `<DataTable>` manage it internally.
   * Omit for the common uncontrolled case; `defaultHiddenColumns` seeds
   * that internal state instead. Has an effect regardless of whether
   * `columnVisibility`'s own built-in menu is rendered -- a consumer can
   * drive column visibility entirely from their own external UI.
   */
  hiddenColumns?: string[];
  /** Initial hidden columns when uncontrolled (`hiddenColumns` omitted). */
  defaultHiddenColumns?: string[];
  /** Called whenever the hidden-column set changes, whether controlled or uncontrolled -- always the FULL current set, not just the one column that changed. */
  onHiddenColumnsChange?: (hiddenColumns: string[]) => void;
  /**
   * Renders arbitrary caller content into the same top toolbar row
   * `quickFilter`'s search box and `densitySelector`'s toggle group share
   * -- alongside density, on the right, since that's the one slot never
   * claimed by a built-in feature. For a consumer who wants their own
   * actions (a refresh button, an export button) living in that same bar
   * instead of a separate one above/below the table. Mounts the bar even
   * if `quickFilter`/`densitySelector`/`selectable` are all false, so this
   * alone is enough to get the row at all.
   */
  renderToolbarExtra?: () => ReactNode;
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
  onEndReached,
  endReachedThreshold = 10,
  defaultPageSize: initialPageSize = 'auto',
  pageSizeOptions = [5, 10, 25, 50, 100],
  itemHeight: explicitItemHeight,
  containerHeight = 'auto',
  rowKey,
  rowSubtheme,
  onRowClick,
  quickFilter = false,
  quickFilterFields,
  quickFilterValue: controlledQuickFilterValue,
  defaultQuickFilterValue,
  onQuickFilterChange,
  sortBy: controlledSortBy,
  defaultSortBy,
  onSortChange,
  page: controlledPage,
  defaultPage,
  onPageChange,
  selectable = false,
  selectionMode = 'multiple',
  selectedKeys: controlledSelectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  disableRowClickSelection = false,
  hideSelectionColumn = false,
  renderBulkActions,
  rowCommands,
  columnWidths: controlledColumnWidths,
  defaultColumnWidths,
  onColumnWidthsChange,
  overrides,
  densitySelector = false,
  density: controlledDensity,
  defaultDensity,
  onDensityChange,
  csvExport = false,
  csvExportFileName = 'export.csv',
  columnVisibility = false,
  hiddenColumns: controlledHiddenColumns,
  defaultHiddenColumns,
  onHiddenColumnsChange,
  renderToolbarExtra,
  emptyState,
}: DataTableProps<T>) {
  const id = useStableId(propId, 'datatable');
  const strings = useLocaleStrings().dataTable;
  const targetDocument = useTargetDocument();

  // The live density feature (issue #339) is only "active" -- i.e. allowed
  // to override whatever `overrides.density`/the theme's own default would
  // otherwise apply -- when the consumer actually opted in via one of these
  // three props. Without that gate, useTableDensity's own internal
  // 'normal' fallback would silently override a live global theme default
  // (set via the Theme Editor) for every <DataTable> that never touched
  // density at all, which is exactly the class of regression `overrides`'s
  // own sparse-CSS-variable design (useSliceOverrides) exists to avoid.
  const densityFeatureActive = densitySelector || controlledDensity !== undefined || defaultDensity !== undefined;
  const { density: liveDensity, handleDensityChange } = useTableDensity({
    density: controlledDensity,
    defaultDensity: defaultDensity ?? overrides?.density,
    onDensityChange,
    tableId: id,
  });
  // Matches `effectiveBorderStyle` below's own established pattern (a
  // best-effort JS read of what's actually in effect, not a live read of
  // the current global theme) for the non-feature case, and additionally
  // folds in the live toggle state when the feature is engaged.
  const effectiveDensity: TableDensity = densityFeatureActive
    ? liveDensity
    : overrides?.density ?? DataTableThemeSlice.defaultState.density;
  const mergedOverrides = densityFeatureActive ? { ...overrides, density: liveDensity } : overrides;
  const itemHeight = explicitItemHeight ?? DENSITY_ROW_HEIGHT_PX[effectiveDensity];
  const { vars } = useSliceOverrides(DataTableThemeSlice, mergedOverrides);
  // Row-level borders below are set directly in JS (not through
  // --ai-table-border, which only reaches the cells' borderRight — see that
  // usage further down), so a flagged row's dashed border needs its own
  // read of the effective borderStyle to respect `overrides={{ borderStyle:
  // 'none' }}` instead of always drawing a border regardless.
  const effectiveBorderStyle = overrides?.borderStyle ?? DataTableThemeSlice.defaultState.borderStyle;
  useInjectInteractionStyles();

  // Column show/hide (issue #340). `visibleColumns` is what every render
  // loop below (colgroup, header row, body cells) actually iterates over --
  // a hidden column occupies no grid position at all, not just a
  // display:none one, so keyboard-nav column coordinates stay contiguous
  // (0..N-1) with no gap left behind by a hidden column. Sorting/quick-filter
  // deliberately keep using the FULL `columns` array (below), not
  // `visibleColumns` -- hiding a column doesn't clear a sort already applied
  // to it, and quickFilterFields is the one dedicated, explicit mechanism
  // for scoping which columns quick-filter searches, independent of display
  // visibility.
  const { hiddenColumnSet, toggleColumnVisibility } = useTableColumnVisibility({
    hiddenColumns: controlledHiddenColumns,
    defaultHiddenColumns,
    onHiddenColumnsChange,
    tableId: id,
  });
  // Not wrapped in useMemo -- hiddenColumnSet is itself a fresh Set on every
  // render (useTableColumnVisibility recomputes it from the hiddenColumns
  // array each call), so a useMemo keyed on it would recompute every render
  // anyway; a plain filter() over a typically-small columns array costs
  // nothing extra by skipping the memoization machinery here.
  const visibleColumns = columns.filter(c => !hiddenColumnSet.has(c.key));
  // Render order for the header/body loops (issue #341) -- every
  // `pinned: 'left'` column first (in their relative `columns` order), then
  // every unpinned column, then every `pinned: 'right'` column last.
  // Deliberately NOT the same as `visibleColumns`'s own declared order:
  // confirmed via a real, live browser (not assumed) that `position: sticky`
  // on adjacent `<table>` cells breaks -- the second sticky cell's stuck
  // position renders wrong -- the moment a non-sticky cell sits BETWEEN two
  // sticky ones in the same row, which is exactly what happens if a pinned
  // column stays in its original declared position instead of moving next
  // to its own edge. This matches how every real production data grid
  // (AG Grid, TanStack Table, MUI X) already handles pinned columns --
  // rendered in dedicated left/center/right sections, never interleaved --
  // not a Toolcrib-specific workaround. `visibleColumns` itself (declared
  // order) stays what CSV export/quickFilter/sorting use -- this reordering
  // is purely a rendering concern, not a data-shape one.
  const displayColumns = [
    ...visibleColumns.filter(c => c.pinned === 'left'),
    ...visibleColumns.filter(c => !c.pinned),
    ...visibleColumns.filter(c => c.pinned === 'right'),
  ];

  // Filtering happens BEFORE sorting -- useTableSort receives filteredData,
  // not the raw data prop, so aria-rowcount/the pagination footer/the
  // virtualization windowing math downstream all already reflect the
  // filtered count without needing their own separate awareness that
  // filtering happened at all.
  const { quickFilterValue, filteredData, handleQuickFilterChange } = useTableQuickFilter({
    data,
    columns,
    quickFilterValue: controlledQuickFilterValue,
    defaultQuickFilterValue,
    onQuickFilterChange,
    tableId: id,
    quickFilterFields,
  });

  const { sortBy, sortedData, handleSort } = useTableSort({
    data: filteredData,
    columns,
    sortBy: controlledSortBy,
    defaultSortBy,
    onSortChange,
    tableId: id,
  });
  const getSortDescriptor = (key: string): SortDescriptor | undefined => sortBy.find(d => d.key === key);

  // Issue #419: 'auto' is now a live-selectable dropdown choice, not just
  // a one-time uncontrolled seed -- `defaultPageSize="auto"` still seeds
  // the *initial* selection the same way `defaultPage`/`defaultSortBy`/etc.
  // already do (a later change to the prop itself still doesn't propagate,
  // same as before), but the dropdown below can now switch the table
  // between 'auto' and any fixed size interactively, which it couldn't do
  // at all previously (the dropdown was simply absent whenever the prop
  // said 'auto'). One state variable for the whole selection, not two
  // (a boolean + a number), so there's exactly one source of truth for
  // "what does the dropdown currently show" -- the previous two-variable
  // shape independently tracked a boolean derived only from the initial
  // prop (never updated after mount) and a number, which made "the
  // dropdown picked auto" inexpressible as a state transition at all.
  const [pageSizeSelection, setPageSizeSelection] = useState<number | 'auto'>(initialPageSize);
  const isAutoPageSize = pageSizeSelection === 'auto';
  // Only meaningful when pageSizeSelection itself isn't 'auto' -- see
  // effectivePageSize below, which is what every real page-size
  // computation downstream actually uses.
  const pageSize = typeof pageSizeSelection === 'number' ? pageSizeSelection : 10;
  // usePagination's own onPageChange closure runs synchronously inside
  // whatever event handler called goToPage — including the page-size
  // select's handler below, which changes pageSize and resets to page 1 in
  // the same event. `setPageSize` is async (doesn't update the `pageSize`
  // closure variable until the next render), so without this ref the emitted
  // `datatable:paginated` payload would report the *old* pageSize for that
  // one case. Kept in sync every render; the page-size handler additionally
  // writes it synchronously before calling goToPage, so it's always current
  // by the time onPageChange reads it, regardless of React's batching.
  const bodyRef = useRef<HTMLDivElement>(null);
  const { height: observedHeight } = useAdaptiveSize(bodyRef);

  // defaultPageSize="auto" / the dropdown's own "Auto" option (issue #364,
  // #419): reuses the exact same live measurement that already drives
  // containerHeight="auto" -- Math.floor(<real body height> / itemHeight)
  // fills a page with exactly as many rows as fit, recomputing whenever
  // the container resizes or density changes itemHeight. Falls back to
  // AUTO_HEIGHT_FALLBACK_PX (the same constant useTableVirtualization
  // itself falls back to) before the very first ResizeObserver report, so
  // the initial render isn't a jarring 0-row page. Math.max(1, ...) guards
  // a pathologically short/hidden container from computing a page size of
  // 0 (no rows would ever be reachable). Factored into a named function,
  // not inlined only where effectivePageSize needs it -- the dropdown's
  // own onChange handler below also needs this exact value synchronously,
  // the moment a user switches TO "Auto", for the same reason pageSizeRef
  // has to be written before goToPage runs (see that ref's own comment).
  const computeAutoPageSize = () =>
    Math.max(1, Math.floor((observedHeight > 0 ? observedHeight : AUTO_HEIGHT_FALLBACK_PX) / itemHeight));
  const effectivePageSize = isAutoPageSize ? computeAutoPageSize() : pageSize;

  const pageSizeRef = useRef(effectivePageSize);
  // useLayoutEffect, not a bare assignment during render -- writing to a
  // ref during render is unsafe under React's stricter rules (a discarded/
  // aborted render attempt could write a value that never actually
  // commits). useLayoutEffect runs synchronously right after commit,
  // before the browser paints or any event handler can run, which is
  // early enough that "kept in sync every render" (this comment's own
  // original claim) still holds by the time any event handler reads it.
  useLayoutEffect(() => {
    pageSizeRef.current = effectivePageSize;
  }, [effectivePageSize]);

  // Pagination — page-index math shared with <Pagination> via the
  // usePagination hook (src/components/shared/usePagination.ts), so there's
  // exactly one page-clamping/controlled-state implementation, not two that
  // can drift. `paginatedData` below still short-circuits entirely when
  // `pagination` is false, same as before this hook existed — step 3's
  // virtualization then windows across the whole sorted array instead of
  // one page at a time.
  const { currentPage: validCurrentPage, totalPages, goToPage: paginationGoToPage } = usePagination({
    totalItems: sortedData.length,
    pageSize: effectivePageSize,
    page: controlledPage,
    defaultPage,
    onPageChange: page => {
      onPageChange?.(page);
      aiBus.emit('datatable:paginated', { id, page, pageSize: pageSizeRef.current });
    },
  });

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (validCurrentPage - 1) * effectivePageSize;
    return sortedData.slice(start, start + effectivePageSize);
  }, [sortedData, validCurrentPage, effectivePageSize, pagination]);

  // A page number valid for the old, larger result set can easily be past
  // the end of a smaller filtered one -- reset to page 1 on every filter
  // change, the same explicit `paginationGoToPage(1)` call the page-size
  // dropdown's own onChange already makes for the identical reason, rather
  // than relying on usePagination's own clamping (which would land on
  // whatever the new LAST valid page is, not necessarily page 1).
  const handleQuickFilterInputChange = (value: string) => {
    handleQuickFilterChange(value);
    paginationGoToPage(1);
  };

  // CSV export (issue #338) -- exports `sortedData`, the FULL filtered +
  // sorted dataset (post-quickFilter, post-sort, pre-pagination-slice), not
  // just `paginatedData` (the current page). "Export everything I'm
  // currently looking at, filtered and ordered the way I set it up" is the
  // useful default every competitor's own free CSV export already matches;
  // exporting only the current page would silently drop every other page's
  // rows, which is not what a user reaching for "export" expects. Uses
  // `visibleColumns` (issue #340), not the full `columns` -- a column the
  // user has explicitly hidden shouldn't reappear in the exported file
  // either, matching "export what I can currently see."
  const handleCsvExport = () => {
    downloadCsvFile(csvExportFileName, columnsToCsv(visibleColumns, sortedData));
    aiBus.emit('datatable:exported', { id, rowCount: sortedData.length });
  };

  // Row selection. `pageOffset` is 0 when pagination is disabled
  // (`paginatedData` is already the full sorted array in that case, so its
  // own index is already dataset-absolute) and the current page's starting
  // offset otherwise -- used only for the index-based selection-key
  // fallback below, entirely separate from `rowKey`'s own existing
  // page-relative index contract (`actualIndex` in the row-render loop),
  // which this doesn't change.
  const pageOffset = pagination ? (validCurrentPage - 1) * effectivePageSize : 0;

  const {
    selectedKeySet,
    getSelectionKey,
    toggleRowSelected,
    toggleSelectAllOnPage,
    handleRowSelectClick,
    allOnPageSelected,
    someOnPageSelected,
  } = useTableSelection({
    selectable,
    selectionMode,
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
    // Changing page, page size, sort, or the quick filter reorders/reslices
    // the dataset the same way -- the virtualization window has to reset
    // for all four, not just page changes, or a scroll offset left over
    // from a differently-sized page/sort/filter result can render as an
    // apparently empty table. `itemHeight` joins the list for a related but
    // distinct reason (issue #339): it doesn't reorder anything, but a
    // density change invalidates what the current scrollTop pixel offset
    // even means against the new row height, so the same reset-to-top
    // treatment applies.
    resetKey: `${validCurrentPage}|${effectivePageSize}|${sortBy.map(d => `${d.key}:${d.direction}`).join(',')}|${quickFilterValue}|${itemHeight}`,
  });

  const visibleRows = paginatedData.slice(startIndex, endIndex);

  // onEndReached (issue #365) -- fires once per distinct totalItems value,
  // not on every render/scroll event while already past the threshold, so
  // a consumer's own in-flight fetch isn't re-triggered repeatedly while
  // it's still loading. Appending more rows changes totalItems, which
  // re-arms this for the next crossing. Only meaningful in continuous-
  // scroll mode (pagination={false}) -- totalItems is `paginatedData.length`,
  // which in paginated mode is just the current PAGE's row count, so
  // "near the end" there means "near the end of this page," not "running
  // low on loaded data," and firing on that would be actively misleading.
  //
  // The bus event fires whenever the threshold is genuinely crossed,
  // regardless of whether `onEndReached` itself was given -- matching
  // every other datatable:* event (datatable:sorted/filtered/paginated all
  // fire unconditionally, independent of whether the matching onSortChange/
  // onQuickFilterChange/onPageChange prop exists). A real, found-via-e2e-
  // testing bug on this feature's first pass: the emit call used to sit
  // behind the same `!onEndReached` guard as the prop callback itself, so
  // a bus-only listener (no onEndReached prop at all) never saw the event.
  //
  // Gemini-caught edge case, addressed: `totalItems` shrinking (a filter
  // narrowing the result set, e.g.) and later growing back to the exact
  // same count it was at when this last fired used to leave
  // firedEndReachedForRef still pinned at that count, silently skipping
  // the re-fire a genuinely-different pass through that same number
  // deserves. Tracking the last-OBSERVED totalItems separately (regardless
  // of whether it fired) and clearing firedEndReachedForRef on any
  // decrease closes this: growing back to a previously-fired-for count
  // after a real dip now correctly re-arms.
  //
  // Deliberately NOT keyed off `data`'s own array reference (the
  // alternative fix for the narrower case this doesn't cover -- a
  // same-length swap to an entirely different, unrelated dataset with no
  // accompanying totalItems change at all) -- `data` is exactly the kind
  // of prop a consumer very commonly passes as a fresh array literal or
  // freshly-mapped/filtered array on every render (this exact class of
  // instability already bit `quickFilterFields` earlier in this same
  // file's own history), which would make this fire on nearly every
  // render past the threshold instead of once, a substantially worse
  // regression than the narrow case it would fix.
  const firedEndReachedForRef = useRef<number | null>(null);
  const lastObservedTotalItemsRef = useRef<number>(totalItems);
  useEffect(() => {
    if (totalItems < lastObservedTotalItemsRef.current) firedEndReachedForRef.current = null;
    lastObservedTotalItemsRef.current = totalItems;

    if (pagination || totalItems === 0) return;
    if (endIndex < totalItems - endReachedThreshold) return;
    if (firedEndReachedForRef.current === totalItems) return;
    firedEndReachedForRef.current = totalItems;
    onEndReached?.();
    aiBus.emit('datatable:end_reached', { id, loadedCount: totalItems });
  }, [pagination, totalItems, endIndex, endReachedThreshold, onEndReached, id]);

  // Grid coordinate layout: column 0 is the selection checkbox/radio column
  // when `selectable` and not `hideSelectionColumn`, otherwise column
  // indices start directly at `visibleColumns` (a hidden column occupies no
  // grid position, see `visibleColumns`'s own comment above); a trailing
  // rowCommands actions column (if any) is always the LAST column. Row 0 is
  // always the header row, rows 1..paginatedData.length are body rows
  // (page-relative, matching `actualIndex + 1`).
  const colOffset = selectable && !hideSelectionColumn ? 1 : 0;
  const hasRowCommands = !!rowCommands && rowCommands.length > 0;
  const gridColumnCount = visibleColumns.length + colOffset + (hasRowCommands ? 1 : 0);
  // Shared by the empty-state row and both virtualization spacer rows below
  // -- every one of them spans the table's real, full column count.
  const totalColSpan = gridColumnCount;
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

  const { getColumnWidth, isResizing, getAriaValues, startResize, handleResizeKeyDown } = useTableColumnResize({
    columnWidths: controlledColumnWidths,
    defaultColumnWidths,
    onColumnWidthsChange,
  });

  // Column pin/freeze (issue #341). SELECTION_COLUMN_WIDTH_PX/
  // rowCommandsColumnWidthPx are the exact same values the colgroup's own
  // `<col>` widths already use ('2.75rem' / `${rowCommands!.length * 2.25 +
  // 1}rem`), just pre-converted to px at this codebase's established 16px
  // root-font assumption (the same one itemHeight's own default already
  // makes) -- needed here because the selection/rowCommands columns
  // auto-pin alongside a left/right-pinned data column (see Column.pinned's
  // own doc) using a KNOWN width, with no need for the real DOM measurement
  // useTableColumnPinning uses for actual data columns (whose width can
  // come from several different sources -- see that hook's own comment).
  const hasLeftPinnedColumn = visibleColumns.some(c => c.pinned === 'left');
  const hasRightPinnedColumn = visibleColumns.some(c => c.pinned === 'right');
  const SELECTION_COLUMN_WIDTH_PX = 44; // 2.75rem
  const selectionColumnPinned = hasLeftPinnedColumn && selectable && !hideSelectionColumn;
  const rowCommandsColumnWidthPx = hasRowCommands ? (rowCommands!.length * 2.25 + 1) * 16 : 0;
  const rowCommandsColumnPinned = hasRightPinnedColumn && hasRowCommands;
  const { registerHeaderCellRef, offsets: pinnedOffsets } = useTableColumnPinning(
    displayColumns,
    selectionColumnPinned ? SELECTION_COLUMN_WIDTH_PX : 0,
    rowCommandsColumnPinned ? rowCommandsColumnWidthPx : 0
  );

  /**
   * Sticky positioning + opaque background + stacking for one pinned
   * column's `<th>`/`<td>`, shared by header and body render loops below.
   * The opaque background is the real reason this can't just be `position:
   * sticky` alone: a `<tr>`'s shared background paints at the ROW's actual
   * horizontal layout position, not wherever a sticky descendant visually
   * ends up once "stuck" -- without an explicit background on the sticky
   * cell itself, scrolled-under sibling cells would show through it. The
   * header's own non-pinned `<th>`s rely on `<thead>`'s shared background
   * instead (fine there, since `<thead>` only sticks vertically, not
   * horizontally) -- a pinned `<th>` needs its own, for the identical
   * reason a pinned `<td>` does. z-index: header-pinned > header-plain (the
   * `<thead>`'s own Z_INDEX.STICKY) > body-pinned > body-plain, so a pinned
   * header cell wins the stacking fight against a scrolling body cell
   * passing underneath it during a simultaneous vertical+horizontal scroll.
   */
  function getPinnedCellStyle(col: Column<T>, isHeader: boolean, rowBackground?: string): CSSProperties | undefined {
    if (!col.pinned) return undefined;
    const isLeft = col.pinned === 'left';
    const offset = (isLeft ? pinnedOffsets.left : pinnedOffsets.right).get(col.key) ?? 0;
    return {
      position: 'sticky',
      [isLeft ? 'left' : 'right']: `${offset}px`,
      zIndex: isHeader ? Z_INDEX.STICKY + 1 : 1,
      background: isHeader ? 'var(--ai-bg-container, #f9fafb)' : rowBackground,
    };
  }

  // Shared resize-handle renderer for a resizable column's <th> -- a
  // role="separator" per the W3C APG Window Splitter pattern (see
  // useTableColumnResize.ts's own header comment), positioned absolutely
  // against the <th>'s own `position: relative` (set below wherever this is
  // rendered). Reads the header cell live via e.currentTarget.closest('th')
  // rather than a persistent ref -- this renders inside two different <th>
  // shapes (sortable-button and plain), so there's no single stable ref to
  // reuse between them. Deliberately NOT part of the roving-tabindex/
  // data-grid-* coordinate model (no data-grid-row/col, no isFocusedCell) --
  // same documented scope limit as any other custom interactive content
  // inside a cell (see useTableKeyboardNav's own header comment): it's a
  // second focusable target inside the column's header cell, reachable via
  // native Tab order, not folded into the single-composite-widget model the
  // sort button/checkbox use.
  const renderResizeHandle = (col: Column<T>) => {
    if (!col.resizable) return null;
    const aria = getAriaValues(col);
    const onDown = (e: ReactMouseEvent<HTMLDivElement> | ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const headerCell = (e.currentTarget as HTMLElement).closest('th');
      if (headerCell) startResize(col, headerCell, e.clientX);
    };
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={aria.valueNow}
        aria-valuemin={aria.valueMin}
        aria-valuemax={aria.valueMax}
        aria-label={`Resize ${col.title} column`}
        tabIndex={0}
        className="ai-focus-ring"
        onMouseDown={onDown}
        onPointerDown={onDown}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          e.stopPropagation();
          const headerCell = (e.currentTarget as HTMLElement).closest('th');
          if (headerCell) handleResizeKeyDown(col, headerCell, e);
        }}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: '0.5rem',
          cursor: 'col-resize',
          touchAction: 'none',
          // Issue #402: accent, not primary -- same reasoning as
          // Splitter's own drag-handle and FileUpload's dropzone: a
          // momentary active-resize highlight, distinct from DataTable's
          // own persistent row-selection color (which stays primary).
          background: isResizing(col.key) ? 'var(--ai-color-accent, #8b5cf6)' : 'transparent',
        }}
      />
    );
  };

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
      {/* Top Toolbar — a single, always-mounted (not toggled by any
          runtime state as a WHOLE) bar combining search, bulk-selection
          status/actions, density, CSV export, column visibility, and any
          caller-supplied extra content. Its own presence is driven by the
          static `quickFilter`/`densitySelector`/`csvExport`/
          `columnVisibility`/`selectable`/`renderToolbarExtra` props, so
          there's no whole-bar layout-jump concern to guard against -- only
          the Center slot's bulk-action content (below) needs its own
          narrower visibility trick, the same one this used to apply to a
          whole separate second row. */}
      {(quickFilter || densitySelector || csvExport || columnVisibility || selectable || renderToolbarExtra) && (
        <div style={{ padding: '0.625rem 1rem', borderBottom: '0.0625rem solid var(--ai-border, #e5e7eb)', flex: '0 0 auto' }}>
          <Toolbar>
            {quickFilter && (
              <Toolbar.Left>
                <input
                  type="search"
                  value={quickFilterValue}
                  onChange={e => handleQuickFilterInputChange(e.target.value)}
                  placeholder={strings.quickFilterPlaceholder}
                  aria-label={strings.quickFilterPlaceholder}
                  className="ai-focus-ring"
                  style={{
                    width: '100%',
                    maxWidth: '20rem',
                    boxSizing: 'border-box',
                    padding: 'var(--ai-padding-xs, 0.375rem 0.625rem)',
                    border: '0.0625rem solid var(--ai-border, #d1d5db)',
                    borderRadius: 'var(--ai-radius-md, 0.375rem)',
                    fontSize: '0.875rem',
                    background: 'var(--ai-bg-surface, #ffffff)',
                    color: 'var(--ai-text-primary, #111827)',
                  }}
                />
              </Toolbar.Left>
            )}
            {selectable && (
              <Toolbar.Center>
                {/* Always mounted once `selectable` (not conditionally, on
                    selectedKeySet.size > 0), toggling only `visibility` --
                    a real, confirmed layout-jump found via direct
                    feedback: mounting/unmounting this on the FIRST
                    selection pushed the entire table down by its height,
                    since `visibility: hidden` (unlike `display: none`)
                    still reserves the element's own box in the layout,
                    selecting row 1 (or clearing back to 0) never moves
                    anything else. */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    visibility: selectedKeySet.size > 0 ? 'visible' : 'hidden',
                  }}
                >
                  <span style={{ fontSize: '0.875rem', fontWeight: 'var(--ai-font-weight-semibold, 600)', color: 'var(--ai-text-primary, #111827)' }}>
                    {selectedKeySet.size} selected
                  </span>
                  {renderBulkActions?.(Array.from(selectedKeySet))}
                </div>
              </Toolbar.Center>
            )}
            {(densitySelector || csvExport || columnVisibility || renderToolbarExtra) && (
              <Toolbar.Right>
                {/* One connected pill across every enabled toolbar-right
                    control (density, Export CSV, Columns, and whatever
                    renderToolbarExtra supplies), not a separate merged
                    cluster per feature -- reported directly, from a real
                    screenshot showing visible gaps between each cluster.
                    UIGroup itself already tolerates any subset of these
                    being absent (Children.toArray filters out a `false`
                    from a disabled feature's `{flag && (...)}`), so this
                    wraps unconditionally rather than needing its own
                    enabled-feature branching. */}
                <UIGroup>
                {densitySelector && (['compact', 'normal', 'spacious'] as const).map(d => (
                  // No wrapping role="group" div around these three
                  // anymore -- confirmed by a real, direct browser
                  // measurement (not assumed) that one defeats correct
                  // per-button corner-squaring no matter how it's styled:
                  // UIGroup's own CSS selectors (`.toolcrib-group > *`,
                  // `:first-child`/`:last-child`) are DOM-tree-based per
                  // the Selectors spec, so they still only ever match the
                  // WRAPPER (one level too shallow), not the three real
                  // buttons inside it, regardless of that wrapper's own
                  // `display` value -- a `display:contents` first attempt
                  // here assumed otherwise and measured wrong: all three
                  // buttons rendered with the SAME border-radius (the
                  // wrapper's own single computed value), not each one's
                  // own correct position-based treatment.
                  // UIGroupContext has the identical shape of problem for
                  // the same underlying reason: Children.toArray on the
                  // outer UIGroup sees any wrapper as exactly one item, so
                  // every descendant of it receives the same single
                  // Context value regardless of its own true position.
                  // These three now have to be genuine, individual direct
                  // children of the outer UIGroup for each to get its own
                  // correct corner treatment -- which is what actually
                  // merges the whole row into one connected pill, the
                  // point of this change in the first place. The "these
                  // three are collectively Row density" context that the
                  // wrapper's aria-label used to carry moves into each
                  // button's own aria-label instead (below) -- a screen
                  // reader still gets the same information, just per
                  // button rather than via a surrounding role="group".
                  <Button
                    key={d}
                    type="button"
                    size="sm"
                    variant={liveDensity === d ? 'secondary' : 'outline'}
                    aria-pressed={liveDensity === d}
                    aria-label={`${strings.densityLabel}: ${strings.densityOptionLabel(d)}`}
                    onClick={() => handleDensityChange(d)}
                  >
                    {strings.densityOptionLabel(d)}
                  </Button>
                ))}
                {csvExport && (
                  <Button type="button" size="sm" variant="outline" onClick={handleCsvExport}>
                    {strings.exportCsvLabel}
                  </Button>
                )}
                {columnVisibility && (
                  // A bespoke Radix DropdownMenu built directly from the
                  // primitive (not the toolkit's own <DropdownMenu>) --
                  // matching this file's own established precedent
                  // (CheckboxPrimitive above, for row selection) of reaching
                  // for a raw Radix primitive when a grid-integrated control
                  // needs a shape the shared component doesn't offer. Here:
                  // <DropdownMenu>'s own MenuItemData is action-item-only
                  // (onSelect always closes the menu), but toggling several
                  // columns in sequence needs the menu to STAY open across
                  // each click -- Radix's own CheckboxItem is built for
                  // exactly that (onSelect prevented below), and the shared
                  // component doesn't expose it.
                  <DropdownMenuPrimitive.Root>
                    <DropdownMenuPrimitive.Trigger asChild>
                      <Button type="button" size="sm" variant="outline">
                        {strings.columnsButtonLabel}
                      </Button>
                    </DropdownMenuPrimitive.Trigger>
                    <DropdownMenuPrimitive.Portal container={targetDocument?.body}>
                      <DropdownMenuPrimitive.Content
                        align="end"
                        sideOffset={4}
                        className="ai-focus-ring"
                        style={{
                          zIndex: Z_INDEX.DROPDOWN,
                          minWidth: '11.25rem',
                          padding: 'var(--ai-padding-sm, 0.375rem)',
                          background: 'var(--ai-bg-surface, #ffffff)',
                          border: '0.0625rem solid var(--ai-border, #e5e7eb)',
                          borderRadius: 'var(--ai-radius-md, 0.375rem)',
                          boxShadow: 'var(--ai-shadow-md, 0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15))',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.125rem',
                          outline: 'none',
                          contain: 'content',
                        }}
                      >
                        {columns.map(col => (
                          <DropdownMenuPrimitive.CheckboxItem
                            key={col.key}
                            checked={!hiddenColumnSet.has(col.key)}
                            onCheckedChange={() => toggleColumnVisibility(col.key)}
                            // Keeps the menu open across multiple toggles --
                            // a checklist, not a one-shot action list (see
                            // this feature's own comment above).
                            onSelect={e => e.preventDefault()}
                            className="ai-menu-item"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: 'var(--ai-dropdownmenu-item-padding, 0.4375rem 0.75rem)',
                              fontSize: '0.875rem',
                              fontWeight: 'var(--ai-font-weight-medium, 500)',
                              borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                              color: 'var(--ai-text-primary, #111827)',
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            {/* Fixed-width reserved space so the label
                                doesn't visually shift left/right as items
                                toggle in and out of the checked state. */}
                            <span aria-hidden="true" style={{ width: '1rem', display: 'inline-flex', justifyContent: 'center' }}>
                              <DropdownMenuPrimitive.ItemIndicator>✓</DropdownMenuPrimitive.ItemIndicator>
                            </span>
                            {col.title}
                          </DropdownMenuPrimitive.CheckboxItem>
                        ))}
                      </DropdownMenuPrimitive.Content>
                    </DropdownMenuPrimitive.Portal>
                  </DropdownMenuPrimitive.Root>
                )}
                {renderToolbarExtra?.()}
                </UIGroup>
              </Toolbar.Right>
            )}
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
          // DOM), +1 for the header row. aria-colcount reflects the real
          // rendered column count -- every VISIBLE column (see
          // `visibleColumns`'s own comment: a `columnVisibility`-hidden
          // column occupies no grid position at all) is always present in
          // the DOM, unlike rows, so aria-colindex per cell isn't needed
          // (the spec only calls for it when the DOM column set is a
          // subset of the full one).
          aria-rowcount={1 + sortedData.length}
          aria-colcount={gridColumnCount}
          onKeyDown={e => {
            // Space toggles the focused row's own selection -- the
            // keyboard equivalent of a plain row click. Scoped to
            // target.tagName === 'TD'/'TH' specifically (a plain cell
            // itself has focus, not a nested widget) so this doesn't
            // double-fire on a checkbox/radio (Space already natively
            // activates a real <button role="checkbox">, which already
            // calls toggleRowSelected via its own onCheckedChange) or a
            // rowCommands action button (Space there should trigger THAT
            // button, not select the row).
            const target = e.target as HTMLElement;
            if (
              selectable &&
              !disableRowClickSelection &&
              e.key === ' ' &&
              focusedRow > 0 &&
              (target.tagName === 'TD' || target.tagName === 'TH')
            ) {
              const rowIndex = focusedRow - 1; // grid row 0 is the header
              const record = paginatedData[rowIndex];
              if (record) {
                e.preventDefault();
                toggleRowSelected(getSelectionKey(record, rowIndex), rowIndex);
              }
            }
            handleKeyDown(e);
          }}
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
            {selectable && !hideSelectionColumn && <col style={{ width: '2.75rem' }} />}
            {displayColumns.map(col => {
              const resolvedWidth = getColumnWidth(col);
              return (
                <col
                  key={col.key}
                  style={{ width: resolvedWidth ? (typeof resolvedWidth === 'number' ? `${resolvedWidth}px` : resolvedWidth) : undefined }}
                />
              );
            })}
            {hasRowCommands && <col style={{ width: `${rowCommands!.length * 2.25 + 1}rem` }} />}
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
              {selectable && !hideSelectionColumn && (
                <th
                  style={{
                    padding: 'var(--ai-table-header-padding, var(--ai-padding-md, 0.75rem 1rem))',
                    width: '2.75rem',
                    ...(selectionColumnPinned
                      ? { position: 'sticky', left: 0, zIndex: Z_INDEX.STICKY + 1, background: 'var(--ai-bg-container, #f9fafb)' }
                      : {}),
                  }}
                  // "Select all" makes no sense for a single-choice model --
                  // in 'single' mode this <th> renders no widget at all, so
                  // (mirroring the sortable/non-sortable data-column pattern
                  // just below) IT carries the grid-nav attributes directly
                  // instead of a nonexistent child widget.
                  {...(selectionMode === 'single'
                    ? { 'data-grid-row': 0, 'data-grid-col': 0, tabIndex: isFocusedCell(0, 0) ? 0 : -1 }
                    : {})}
                  className={selectionMode === 'single' ? 'ai-focus-ring' : undefined}
                >
                  {/* Real Gemini-caught defect (PR #333): this <th> is
                      genuinely empty in 'single' mode (no "select all"
                      control makes sense for one choice), but the grid-nav
                      attributes above still make it focusable -- an empty,
                      unlabeled focusable cell announced nothing useful to a
                      screen reader. A visually-hidden label gives it a real
                      accessible name without adding visible content next to
                      every other column's own real header text. */}
                  {selectionMode === 'single' && <VisuallyHidden>Row selection</VisuallyHidden>}
                  {selectionMode !== 'single' && (
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
                  )}
                </th>
              )}
              {displayColumns.map((col, colIndex) => {
                const isSortable = col.sortable === true;
                const gridCol = colOffset + colIndex;
                const sortDescriptor = isSortable ? getSortDescriptor(col.key) : undefined;
                // 1-indexed priority within the current multi-column sort
                // -- only shown once a SECOND column is actually part of
                // the sort (sortBy.length > 1); a lone sorted column looks
                // exactly like a single-sort table always did, no badge.
                const sortPriority = sortDescriptor && sortBy.length > 1 ? sortBy.indexOf(sortDescriptor) + 1 : null;
                const pinnedStyle = getPinnedCellStyle(col, true);
                return (
                  <th
                    key={col.key}
                    ref={col.pinned ? registerHeaderCellRef(col.key) : undefined}
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
                        ? sortDescriptor
                          ? sortDescriptor.direction === 'asc' ? 'ascending' : 'descending'
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
                      width: getColumnWidth(col),
                      // Anchors the resize handle's absolute positioning
                      // below -- harmless when col.resizable is false since
                      // nothing renders inside this th to be positioned
                      // against it either way. A pinned column's own
                      // `position: sticky` (via pinnedStyle, spread after)
                      // works equally well as that anchor, so this only
                      // needs to apply when NOT pinned.
                      position: col.resizable && !col.pinned ? 'relative' : undefined,
                      ...pinnedStyle,
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
                        onClick={e => handleSort(col.key, e.shiftKey)}
                        title="Click to sort. Shift+click to add a secondary sort."
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
                        {sortDescriptor && (
                          // aria-sort on the <th> above already conveys sort
                          // direction programmatically -- without
                          // aria-hidden, a screen reader also announces
                          // this character literally ("black up-pointing
                          // triangle"), redundant and confusing next to
                          // that.
                          <span aria-hidden="true">{sortDescriptor.direction === 'asc' ? '▲' : '▼'}</span>
                        )}
                        {sortPriority !== null && (
                          <>
                            {/* Only rendered once a second column has
                                actually joined the sort (see sortPriority's
                                own comment above). Purely a visual aid for
                                a sighted user glancing at the header row --
                                aria-sort conveys THIS column's own
                                direction, but not its priority relative to
                                any other sorted column, which is exactly
                                what a screen reader user is missing
                                without the VisuallyHidden text alongside
                                it below (real Gemini-caught defect, PR
                                #337: this badge was originally
                                aria-hidden with no accessible replacement
                                at all, so a screen reader user could tell
                                "this column is sorted" from aria-sort
                                alone, but never which one is primary vs.
                                secondary). */}
                            <span
                              aria-hidden="true"
                              style={{
                                fontSize: '0.625rem',
                                fontWeight: 'var(--ai-font-weight-bold, 700)',
                                color: 'var(--ai-color-primary-text, #ffffff)',
                                background: 'var(--ai-color-primary, #3b82f6)',
                                borderRadius: 'var(--ai-radius-xl, 999px)',
                                minWidth: '1rem',
                                height: '1rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0 0.25rem',
                                boxSizing: 'border-box',
                              }}
                            >
                              {sortPriority}
                            </span>
                            <VisuallyHidden>{`sort priority ${sortPriority}`}</VisuallyHidden>
                          </>
                        )}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        {col.title}
                      </div>
                    )}
                    {renderResizeHandle(col)}
                  </th>
                );
              })}
              {hasRowCommands && (
                <th
                  data-grid-row={0}
                  data-grid-col={colOffset + visibleColumns.length}
                  tabIndex={isFocusedCell(0, colOffset + visibleColumns.length) ? 0 : -1}
                  className="ai-focus-ring"
                  style={{
                    padding: 'var(--ai-table-header-padding, var(--ai-padding-md, 0.75rem 1rem))',
                    ...(rowCommandsColumnPinned
                      ? { position: 'sticky', right: 0, zIndex: Z_INDEX.STICKY + 1, background: 'var(--ai-bg-container, #f9fafb)' }
                      : {}),
                  }}
                >
                  <VisuallyHidden>Row actions</VisuallyHidden>
                </th>
              )}
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
                <td colSpan={totalColSpan} style={{ padding: '2rem 1rem', textAlign: 'center' }}>
                  {/* Crossfade (issue #371) -- a plain CSS `animation`, not
                      Presence: the empty <tr> and the real virtualized row
                      set are two entirely different element structures at
                      the same tree position (this ternary's two branches),
                      so React always unmounts one and mounts the other on
                      every flip -- there's no way to keep both mounted at
                      once inside a valid <tbody> to animate a true, both-
                      sides-fading overlap (a stray wrapper <div> around
                      multiple <tr> siblings isn't valid table markup, and
                      Presence itself only ever wraps a single element).
                      This mount-only entrance (no exit animation attempted
                      for the same structural reason) is the honest, safe
                      version: reuses ai-scale-in (opacity + transform,
                      already shared/injected by ThemeProvider -- no new
                      keyframe needed) and the same --ai-transition-* tokens
                      the focus-ring fade/Toast's own animations already
                      use, which collapse to 0s automatically under
                      reducedMotion (theme/animation.tsx's own token
                      derivation), so no separate reduced-motion branch is
                      needed here either. Applied to an inner <div>, not the
                      <td> itself -- `transform` on a table CELL has real
                      cross-browser rendering quirks (border/background
                      distortion) that a plain block-level wrapper avoids
                      entirely. Not sharing a class with any focusable
                      element (plain content, no .ai-focus-ring), so the
                      transition-shorthand collision class of bug fixed for
                      Toast (issue #358) doesn't apply here -- checked, not
                      assumed. */}
                  <div style={{ animation: 'ai-scale-in var(--ai-transition-duration-normal, 200ms) var(--ai-transition-easing, ease)' }}>
                    {emptyState}
                  </div>
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
                    <td colSpan={totalColSpan} style={{ height: `${startIndex * itemHeight}px`, padding: 0 }} />
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

                  // Selection visual feedback (issue #360): a left
                  // indicator + inset border on the cells themselves,
                  // instead of a full-row background tint -- so a custom
                  // rowSubtheme/zebra-stripe background stays fully
                  // visible on a selected row, not washed out underneath
                  // an overlay. Applied via box-shadow (not border/
                  // background), deliberately: box-shadow doesn't affect
                  // box sizing, so toggling selection never causes even a
                  // 1px content reflow the way a real border would.
                  //
                  // Contiguous multi-select regions merge into one
                  // continuous block rather than drawing a separate frame
                  // around every row (which would look like a ladder of
                  // thick lines through an already-dense, zebra-striped
                  // grid): a selected row's own TOP cap only renders when
                  // the row immediately above it isn't ALSO selected, and
                  // its BOTTOM cap only renders when the row immediately
                  // below it isn't either. An isolated single selected row
                  // (neither neighbor selected) gets both caps and reads
                  // as a fully framed row; the middle of a multi-row
                  // selection gets neither, so no horizontal divider
                  // appears between two selected rows sitting next to each
                  // other. Neighbors are looked up directly in
                  // `paginatedData` (the full current-page array, not
                  // `visibleRows`) so this merges correctly across a
                  // virtualization window boundary, not just between rows
                  // that happen to be rendered at the same time.
                  const prevRecord = actualIndex > 0 ? paginatedData[actualIndex - 1] : undefined;
                  const nextRecord = actualIndex < paginatedData.length - 1 ? paginatedData[actualIndex + 1] : undefined;
                  const prevRowSelected =
                    isRowSelected && prevRecord !== undefined && selectedKeySet.has(getSelectionKey(prevRecord, actualIndex - 1));
                  const nextRowSelected =
                    isRowSelected && nextRecord !== undefined && selectedKeySet.has(getSelectionKey(nextRecord, actualIndex + 1));
                  const selectionAccentColor = 'var(--ai-color-primary, #3b82f6)';
                  const selectionFrameShadows: string[] = [];
                  if (isRowSelected && !prevRowSelected) selectionFrameShadows.push(`inset 0 0.125rem 0 0 ${selectionAccentColor}`);
                  if (isRowSelected && !nextRowSelected) selectionFrameShadows.push(`inset 0 -0.125rem 0 0 ${selectionAccentColor}`);
                  // The FIRST cell in the row (the selection checkbox/radio
                  // <td> when present, otherwise the first data column)
                  // additionally carries the left accent bar -- box-shadow
                  // is local to each element's own box, so this can't be
                  // set once on the row and expected to bleed into every
                  // cell the way a <tr>-level border would.
                  const otherCellsSelectionShadow = isRowSelected && selectionFrameShadows.length > 0 ? selectionFrameShadows.join(', ') : 'none';
                  const firstCellSelectionShadow = isRowSelected
                    ? [`inset 0.25rem 0 0 0 ${selectionAccentColor}`, ...selectionFrameShadows].join(', ')
                    : 'none';
                  const hasSelectionCell = selectable && !hideSelectionColumn && selectionKey !== null;
                  // Reused by both the <tr> itself (below) and, for a
                  // PINNED cell specifically, a real-browser-screenshot-
                  // caught variant that flattens it to a guaranteed-opaque
                  // color -- see getPinnedCellStyle's own comment for why a
                  // sticky cell needs its own explicit opaque background
                  // rather than relying on the row's shared one.
                  const rowBackgroundColor = subthemeColors?.background
                    ? subthemeColors.background
                    : actualIndex % 2 === 0 ? 'transparent' : 'var(--ai-table-stripe-bg, var(--ai-bg-container, #f9fafb))';
                  // A naive `rowBackgroundColor === 'transparent' ? <opaque
                  // fallback> : rowBackgroundColor` substitution (this
                  // code's own first version) missed a real case, found via
                  // a real browser screenshot, not reasoning: a custom
                  // `rowSubtheme` background can ALSO be semi-transparent
                  // (the demo's own "top performer" highlight is `rgba(...,
                  // 0.12)`) -- not the literal string 'transparent', so that
                  // check passed it through unchanged, and 12%-opacity is
                  // still transparent enough for scrolled-under sibling-cell
                  // content to visibly bleed through a pinned cell. A
                  // stacked `linear-gradient(X, X)` image layer OVER a
                  // plain opaque `background-color` is the general fix for
                  // ANY row background, not just the literal-transparent
                  // special case: the gradient layer paints
                  // `rowBackgroundColor` exactly as authored (including any
                  // alpha), and the solid color underneath is only ever
                  // visible through whatever alpha that top layer leaves --
                  // never through to actual scrolled-under DOM content,
                  // which is the whole point.
                  const pinnedCellBackgroundColor = `linear-gradient(${rowBackgroundColor}, ${rowBackgroundColor}), var(--ai-bg-surface, #ffffff)`;

                  return (
                    <tr
                      key={key}
                      // +2: 1-based, plus the header row -- see the
                      // <table>'s own aria-rowcount comment on why this
                      // reflects the row's position across the whole
                      // dataset (pageOffset), not just the current page.
                      aria-rowindex={pageOffset + actualIndex + 2}
                      // aria-selected reflects real selection state
                      // regardless of `hideSelectionColumn` -- a screen
                      // reader user still needs to know a row is selected
                      // even when there's no visible checkbox/radio widget
                      // to convey it. `undefined` (not `false`) when
                      // selection isn't active at all, matching aria-sort's
                      // own "omit when not applicable" convention elsewhere
                      // in this file.
                      aria-selected={selectable ? isRowSelected : undefined}
                      onClick={e => {
                        onRowClick?.(record, actualIndex);
                        aiBus.emit('datatable:row_clicked', { id, index: actualIndex });
                        if (selectable && !disableRowClickSelection && selectionKey !== null) {
                          handleRowSelectClick(selectionKey, actualIndex, {
                            shiftKey: e.shiftKey,
                            ctrlKey: e.ctrlKey,
                            metaKey: e.metaKey,
                          });
                        }
                      }}
                      style={{
                        height: `${itemHeight}px`,
                        cursor: onRowClick || (selectable && !disableRowClickSelection) ? 'pointer' : undefined,
                        borderBottom: subthemeColors?.border
                          ? effectiveBorderStyle === 'none'
                            ? 'none'
                            : `0.0625rem dashed ${subthemeColors.border}`
                          : '0.0625rem solid var(--ai-border, #f3f4f6)',
                        backgroundColor: rowBackgroundColor,
                        // Selection no longer washes the row's own
                        // background at all (issue #360) -- a custom
                        // rowSubtheme tint or zebra stripe stays exactly as
                        // it is regardless of selection state, so a
                        // selected error/warning row doesn't lose its own
                        // color coding. The left-indicator + inset-border
                        // treatment (each <td>'s own boxShadow, computed
                        // above) is what conveys selection now.
                        transition: 'background-color var(--ai-transition-duration-fast, 0.15s) var(--ai-transition-easing, ease)',
                      }}
                    >
                      {selectable && !hideSelectionColumn && selectionKey !== null && (
                        <td
                          style={{
                            padding: 'var(--ai-table-cell-padding, var(--ai-padding-sm, 0.5rem 1rem))',
                            // Always the row's first cell when rendered at
                            // all -- carries the left accent bar as well as
                            // the top/bottom frame caps (see this row's own
                            // comment above on how those are computed).
                            boxShadow: firstCellSelectionShadow,
                            ...(selectionColumnPinned
                              ? { position: 'sticky', left: 0, zIndex: 1, background: pinnedCellBackgroundColor }
                              : {}),
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          {selectionMode === 'single' ? (
                            // A plain hand-rolled role="radio" button, not
                            // CheckboxPrimitive -- Radix's Checkbox always
                            // owns its own role="checkbox" internally, and
                            // its sibling RadioGroup primitive brings its
                            // OWN internal arrow-key navigation between
                            // items, which would compete with this table's
                            // own custom grid roving-tabindex model for the
                            // exact same keys. A single real <button> gets
                            // Space/Enter activation for free with none of
                            // that conflict -- deliberately not the full
                            // APG radio-group pattern's own arrow-key
                            // navigation between radios, since arrow keys
                            // here already mean "move focus to the
                            // adjacent grid cell."
                            <button
                              type="button"
                              role="radio"
                              aria-checked={isRowSelected}
                              aria-label={`Select row ${actualIndex + 1}`}
                              onClick={() => toggleRowSelected(selectionKey, actualIndex)}
                              className="ai-focus-ring"
                              data-grid-row={gridRow}
                              data-grid-col={0}
                              tabIndex={isFocusedCell(gridRow, 0) ? 0 : -1}
                              style={{
                                all: 'unset',
                                width: '1.125rem',
                                height: '1.125rem',
                                borderRadius: '50%',
                                border: `0.0625rem solid ${isRowSelected ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-border, #d1d5db)'}`,
                                background: 'var(--ai-bg-surface, #ffffff)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxSizing: 'border-box',
                              }}
                            >
                              {isRowSelected && (
                                <span
                                  aria-hidden="true"
                                  style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: 'var(--ai-color-primary, #3b82f6)' }}
                                />
                              )}
                            </button>
                          ) : (
                            <CheckboxPrimitive.Root
                              checked={isRowSelected}
                              onCheckedChange={() => toggleRowSelected(selectionKey, actualIndex)}
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
                          )}
                        </td>
                      )}
                      {displayColumns.map((col, colIndex) => {
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
                              // Only the true first cell of the row (this
                              // column when there's no selection <td>
                              // rendered before it) carries the left accent
                              // -- every other cell just carries the
                              // top/bottom frame caps, if any.
                              boxShadow: !hasSelectionCell && colIndex === 0 ? firstCellSelectionShadow : otherCellsSelectionShadow,
                              ...getPinnedCellStyle(col, false, pinnedCellBackgroundColor),
                            }}
                          >
                            {col.render ? col.render({ value, row: record, index: actualIndex }) : String(value ?? '')}
                          </td>
                        );
                      })}
                      {hasRowCommands && (
                        <td
                          data-grid-row={gridRow}
                          data-grid-col={colOffset + visibleColumns.length}
                          tabIndex={isFocusedCell(gridRow, colOffset + visibleColumns.length) ? 0 : -1}
                          className="ai-focus-ring"
                          onClick={e => e.stopPropagation()}
                          style={{
                            padding: 'var(--ai-table-cell-padding, var(--ai-padding-sm, 0.5rem 1rem))',
                            // Always the last cell, never the first -- only
                            // the top/bottom frame caps apply here.
                            boxShadow: otherCellsSelectionShadow,
                            ...(rowCommandsColumnPinned
                              ? { position: 'sticky', right: 0, zIndex: 1, background: pinnedCellBackgroundColor }
                              : {}),
                          }}
                        >
                          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                            {rowCommands!
                              .filter(cmd => cmd.isVisible?.(record, actualIndex) ?? true)
                              .map(cmd => (
                                <button
                                  key={cmd.id}
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    aiBus.emit('datatable:row_command', {
                                      id,
                                      command: cmd.id,
                                      key: getSelectionKey(record, actualIndex),
                                      index: actualIndex,
                                    });
                                  }}
                                  aria-label={cmd.label}
                                  title={cmd.label}
                                  // Gated to the SAME isFocusedCell condition
                                  // as the wrapping <td> above, not left at
                                  // the browser's own default tabIndex=0 --
                                  // real Gemini-caught defect (PR #333): an
                                  // unconditional tabIndex=0 here meant a
                                  // plain page Tab sweep (not this grid's own
                                  // arrow-key nav) stopped at every command
                                  // button on every visible row, one row at a
                                  // time, before it could ever leave the
                                  // table. Matches the W3C APG Grid pattern's
                                  // own intent: Tab moves focus OUT of the
                                  // composite widget entirely; arrow keys
                                  // move focus WITHIN it. Reaching this row's
                                  // actions cell via the grid's arrow-key nav
                                  // still makes every command button here
                                  // tabbable together (a real, deliberate
                                  // exception to "one focus target per grid
                                  // coordinate" -- there's more than one
                                  // widget in this one cell), so a keyboard
                                  // user can still Tab between them once
                                  // they've actually arrived at this row.
                                  tabIndex={isFocusedCell(gridRow, colOffset + visibleColumns.length) ? 0 : -1}
                                  // ai-btn (issue #370) -- a plain `all:
                                  // 'unset'` icon button had a pointer
                                  // cursor and nothing else: no hover
                                  // background, no :active press feedback,
                                  // nothing to signal it's actually a
                                  // clickable button rather than a static
                                  // icon. .ai-btn gives it the same
                                  // systematic hover-tint/:active-scale
                                  // treatment every other icon button in
                                  // the toolkit already has (Carousel's
                                  // nav arrows, Select's trigger), falling
                                  // back to a transparent base background
                                  // via its own --ai-btn-bg fallback --
                                  // exactly right for a ghost icon button
                                  // with no background at rest.
                                  //
                                  // Explicit resets below (border/background/
                                  // padding/font), NOT `all: 'unset'` --
                                  // real, Gemini-caught defect on this PR's
                                  // first pass, confirmed directly: `all:
                                  // 'unset'` is itself an INLINE declaration,
                                  // which (per the CSS cascade's origin/
                                  // importance rules, not a specificity
                                  // contest) beats any stylesheet rule that
                                  // ISN'T `!important`. `.ai-btn:hover`'s
                                  // background and `.ai-focus-ring`'s
                                  // outline ARE `!important` (confirmed
                                  // still working, directly, in a real
                                  // browser), but `.ai-btn:active`'s own
                                  // press-down `transform` deliberately
                                  // isn't -- so the inline `all: 'unset'`
                                  // silently reset `transform` to `none` and
                                  // no press feedback ever showed. Matching
                                  // Carousel's/Select's own established
                                  // pattern (explicit per-property resets,
                                  // never `all: 'unset'`) leaves `transform`
                                  // untouched inline, so `.ai-btn:active`'s
                                  // class rule is free to apply normally.
                                  className="ai-btn ai-focus-ring"
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    padding: 0,
                                    font: 'inherit',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '1.75rem',
                                    height: '1.75rem',
                                    borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                                    cursor: 'pointer',
                                    color: 'var(--ai-text-secondary, #6b7280)',
                                    fontSize: '0.875rem',
                                  }}
                                >
                                  {cmd.icon ? <span aria-hidden="true">{cmd.icon}</span> : cmd.label}
                                </button>
                              ))}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}

                {/* Virtual Spacer Bottom -- same reasoning as the top spacer. */}
                {endIndex < totalItems && (
                  <tr aria-hidden="true">
                    <td colSpan={totalColSpan} style={{ height: `${(totalItems - endIndex) * itemHeight}px`, padding: 0 }} />
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
            totalItems > 0 ? (validCurrentPage - 1) * effectivePageSize + 1 : 0,
            Math.min(validCurrentPage * effectivePageSize, sortedData.length),
            sortedData.length
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <UIGroup>
            {/* Issue #419: "Auto" is a real, always-present option here now,
                not a state the dropdown disappears for. Switching to it
                writes pageSizeRef synchronously via computeAutoPageSize()
                for the exact same reason the numeric branch already writes
                the ref before calling goToPage (see that comment) --
                goToPage's onPageChange callback runs synchronously, before
                React's async state update reaches either closure
                variable. */}
            <select
              aria-label={strings.rowsPerPage}
              value={isAutoPageSize ? 'auto' : pageSize}
              onChange={e => {
                if (e.target.value === 'auto') {
                  pageSizeRef.current = computeAutoPageSize();
                  setPageSizeSelection('auto');
                } else {
                  const newSize = Number(e.target.value);
                  pageSizeRef.current = newSize;
                  setPageSizeSelection(newSize);
                }
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
              <option value="auto">{strings.perPageAutoOption}</option>
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
