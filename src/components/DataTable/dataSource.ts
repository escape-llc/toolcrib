import type { Column, SortDescriptor } from './DataTable';
import { filterRows, sortRows } from './tableQuery';

/**
 * What `<DataTable>` asks a data source for: one range of rows, in the
 * server's own sorted and filtered order. Handed to `DataTableDataSource.getRows`.
 * @barrelExport
 */
export interface DataTableQuery {
  /** First row index (0-based) of the requested range, in the sorted/filtered order. */
  start: number;
  /** Number of rows requested. The built-in array source is asked for every row (`Infinity`) when `pagination` is off. */
  count: number;
  /** The table's current sort, in priority order (index 0 is the primary sort key). Empty when unsorted. */
  sortBy: SortDescriptor[];
  /** Current quick-filter text ('' when none). Debounced before it becomes a request when the source answers with a Promise. */
  quickFilter: string;
  /** Aborted when this request is superseded (the page, sort or filter changed, or the table unmounted). Pass it to `fetch`. */
  signal: AbortSignal;
}

/** The rows for one `DataTableQuery`, plus the size of the whole result set. */
export interface DataTableResult<T> {
  /** The rows for the requested range, exactly as they should be shown. The table does no sorting or filtering of its own on a data source's rows. */
  rows: T[];
  /** Total rows matching the current sort/filter, across every page. Drives the page count, the "Showing X to Y of Z" footer, `aria-rowcount` and the empty state. */
  totalCount: number;
}

/**
 * Where a `<DataTable>` gets its rows from -- an alternative to passing an
 * array as `data`. Each method may return a value or a Promise, so an
 * `async` function is a valid implementation as written; the table awaits
 * it. A rejected Promise becomes the table's error state, and an
 * `AbortError` from a superseded request is swallowed. Define the source
 * once (module scope, or memoized): a new object identity passed as `data`
 * means "start over and refetch".
 */
export interface DataTableDataSource<T> {
  /**
   * Returns the rows for a query, as a value or a Promise. The table calls
   * this from an effect, never during render, and shows its loading state
   * until it answers. Only the built-in array source (`createArrayDataSource`)
   * is read during render, so its rows are there in the first frame.
   */
  getRows(query: DataTableQuery): DataTableResult<T> | Promise<DataTableResult<T>>;
  /**
   * Optional: every row matching the query, for the built-in CSV export.
   * Without it the Export CSV button is not shown.
   */
  exportRows?(query: Omit<DataTableQuery, 'start' | 'count'>): T[] | Promise<T[]>;
  /**
   * Optional: every row key matching the query, so the header "select all"
   * checkbox can mean every matching row. Without it, "select all" covers
   * only the rows currently loaded.
   */
  getAllKeys?(query: Omit<DataTableQuery, 'start' | 'count'>): string[] | Promise<string[]>;
}

/** Options for `createArrayDataSource`. */
export interface ArrayDataSourceOptions<T> {
  /** The table's columns -- the array source sorts and filters by their resolved values (`accessorFn` if given, else `record[key]`). */
  columns: Column<T>[];
  /** Restricts quick-filter matching to these column keys. Omit to search every column. */
  quickFilterFields?: string[];
  /** Row key for `getAllKeys`. Without it, a row's key is its position in the sorted/filtered result. */
  rowKey?: (record: T, index: number) => string | number;
}

/** What `createArrayDataSource` returns: a `DataTableDataSource` whose three methods are known to answer synchronously. */
export interface ArrayDataSource<T> extends DataTableDataSource<T> {
  getRows(query: DataTableQuery): DataTableResult<T>;
  exportRows(query: Omit<DataTableQuery, 'start' | 'count'>): T[];
  getAllKeys(query: Omit<DataTableQuery, 'start' | 'count'>): string[];
}

/**
 * The built-in data source for an array: filters (quick filter), then
 * sorts, then slices the requested range, all synchronously. `<DataTable>`
 * builds one internally when `data` is an array; call it yourself to wrap
 * an array and add to it, e.g. `{ ...createArrayDataSource(rows, opts),
 * exportRows: ... }` to export something other than the table's own rows.
 * Provides `exportRows` and `getAllKeys` as well. The filtered and sorted
 * result is cached for the last sort/filter, so paging through it doesn't
 * re-sort the array.
 */
export function createArrayDataSource<T extends Record<string, any>>(
  rows: T[],
  { columns, quickFilterFields, rowKey }: ArrayDataSourceOptions<T>
): ArrayDataSource<T> {
  let cache: { key: string; rows: T[] } | null = null;
  const matching = ({ sortBy, quickFilter }: Pick<DataTableQuery, 'sortBy' | 'quickFilter'>): T[] => {
    const key = `${sortBy.map(d => `${d.key}:${d.direction}`).join(',')}|${quickFilter}`;
    if (cache?.key !== key) cache = { key, rows: sortRows(filterRows(rows, columns, quickFilterFields, quickFilter), columns, sortBy) };
    return cache.rows;
  };
  const source: ArrayDataSource<T> = {
    getRows(query) {
      const all = matching(query);
      return { rows: all.slice(query.start, query.start + query.count), totalCount: all.length };
    },
    exportRows: query => matching(query),
    getAllKeys: query => matching(query).map((record, i) => String(rowKey ? rowKey(record, i) : i)),
  };
  // Non-enumerable, so spreading the source to override a method (which
  // makes it something other than an in-memory array source) drops the brand.
  Object.defineProperty(source, ARRAY_SOURCE, { value: true });
  return source;
}

const ARRAY_SOURCE = Symbol.for('toolcrib.dataTable.arraySource');

/**
 * Whether `source` is a built-in array source (made by
 * `createArrayDataSource`): pure in-memory work, so `<DataTable>` reads it
 * during render and shows its rows in the first frame. Any other source is
 * called from an effect and may be asynchronous.
 */
export function isArrayDataSource<T>(source: DataTableDataSource<T>): source is ArrayDataSource<T> {
  return (source as unknown as Record<symbol, unknown>)[ARRAY_SOURCE] === true;
}

/** Whether `data` is a data source (an object with a `getRows` method) rather than an array of rows. */
export function isDataSource<T>(data: T[] | DataTableDataSource<T>): data is DataTableDataSource<T> {
  return !Array.isArray(data) && typeof data === 'object' && data !== null && typeof (data as DataTableDataSource<T>).getRows === 'function';
}
