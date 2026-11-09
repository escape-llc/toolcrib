'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import type { SortDescriptor } from './DataTable';
import { isArrayDataSource, type DataTableDataSource, type DataTableResult } from './dataSource';

/** How long quick-filter typing must pause before it becomes a request, for any source but the built-in array source. */
export const FILTER_DEBOUNCE_MS = 250;

const NO_ROWS: never[] = [];

export interface UseDataSourceRowsOptions<T> {
  source: DataTableDataSource<T>;
  /** First row index of the requested range. */
  start: number;
  /** Number of rows requested. */
  count: number;
  sortBy: SortDescriptor[];
  /** The live quick-filter text (undebounced). */
  quickFilter: string;
  /** This table instance's id, for the `datatable:load_error` payload. */
  tableId: string;
  /** Called when a debounced quick-filter change commits into a request, so the caller can return to page 1 in the same batch. */
  onFilterCommit?: (value: string) => void;
}

export interface UseDataSourceRowsResult<T> {
  /** The rows to show. While a later request is loading these stay the previous request's rows, so the table doesn't flash empty. */
  rows: T[];
  /** Total rows matching the query, from the last successful result. `null` until a first result has arrived. */
  totalCount: number | null;
  /** The `start` of the query that produced `rows` -- not the requested one while a later request loads or has failed. */
  rowsStart: number;
  status: 'ready' | 'loading' | 'error';
  error: Error | null;
  /** Re-requests the current query (also what `datatable:refresh` triggers). */
  retry: () => void;
  /** Whether rows arrive asynchronously (every source except the built-in array source). */
  isAsync: boolean;
}

interface Settled<T> {
  lastGood: { rows: T[]; totalCount: number; start: number } | null;
  /** The query key of the request that last settled. */
  settled: object | null;
  error: Error | null;
}

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError';
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Failed to load rows');
}

/** A result with a usable `totalCount`: a server that omits it falls back to the rows it did send. */
function normalize<T>(result: DataTableResult<T>): DataTableResult<T> {
  return { rows: result.rows, totalCount: Number.isFinite(result.totalCount) ? result.totalCount : result.rows.length };
}

/**
 * The one path every `<DataTable>` gets its rows through: asks the data
 * source for `{ start, count, sortBy, quickFilter }` and reports what comes
 * back.
 *
 * What the source IS decides how, never what it returns. The built-in array
 * source (see `isArrayDataSource`) is pure in-memory work, so it is read
 * during render and the first frame already has its rows. Every other
 * source is called only from an effect, once per query, with a fresh
 * `AbortController`: the request is aborted when the query or source
 * changes or the table unmounts, a superseded request's late result is
 * ignored even if the source ignored `signal`, an `AbortError` is
 * swallowed, and a rejection or throw becomes `status: 'error'`. Render
 * never starts a request, so a discarded render leaks nothing. A source's
 * answer that is not a Promise is treated as an already-resolved one.
 * Quick-filter typing is debounced for every source but the array source.
 */
export function useDataSourceRows<T>({
  source,
  start,
  count,
  sortBy,
  quickFilter,
  tableId,
  onFilterCommit,
}: UseDataSourceRowsOptions<T>): UseDataSourceRowsResult<T> {
  const [nonce, setNonce] = useState(0);
  const retry = useCallback(() => setNonce(n => n + 1), []);
  const isSync = isArrayDataSource(source);

  // `sortBy` is a new array whenever a controlled parent re-renders with an
  // inline literal; keying on its content keeps the query (and so the
  // request) from changing on every render.
  const sortKey = sortBy.map(d => `${d.key}:${d.direction}`).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sortKey stands in for sortBy's content, see the comment above.
  const stableSortBy = useMemo(() => sortBy, [sortKey]);

  const [debouncedFilter, setDebouncedFilter] = useState(quickFilter);
  if (isSync && debouncedFilter !== quickFilter) setDebouncedFilter(quickFilter);
  const filterUsed = isSync ? quickFilter : debouncedFilter;

  // Identifies one query (and one retry) of one source: a fresh object
  // whenever any of them changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the deps ARE the query; the value is only an identity.
  const queryKey = useMemo(() => ({}), [source, start, count, stableSortBy, filterUsed, nonce]);

  // Array source only: in-memory, side-effect free, safe to run in render.
  const syncOutcome = useMemo<{ result: DataTableResult<T> } | { error: Error } | null>(() => {
    if (!isSync) return null;
    try {
      const answer = source.getRows({ start, count, sortBy: stableSortBy, quickFilter: filterUsed, signal: new AbortController().signal });
      return { result: normalize(answer as DataTableResult<T>) };
    } catch (error) {
      return { error: toError(error) };
    }
    // `nonce` re-reads on retry/refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSync, source, start, count, stableSortBy, filterUsed, nonce]);

  const [state, setState] = useState<Settled<T>>({ lastGood: null, settled: null, error: null });

  const onFilterCommitRef = useRef(onFilterCommit);
  useEffect(() => {
    onFilterCommitRef.current = onFilterCommit;
  }, [onFilterCommit]);

  useEffect(() => {
    if (isSync || debouncedFilter === quickFilter) return;
    const timeoutId = setTimeout(() => {
      setDebouncedFilter(quickFilter);
      onFilterCommitRef.current?.(quickFilter);
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
  }, [isSync, quickFilter, debouncedFilter]);

  // Any other source: the request is made here, never in render. Each run
  // owns its own AbortController, so a StrictMode mount/cleanup/mount aborts
  // the first request and issues the second.
  useEffect(() => {
    if (isSync) return;
    const controller = new AbortController();
    let live = true;
    let promise: Promise<DataTableResult<T>>;
    try {
      promise = Promise.resolve(source.getRows({ start, count, sortBy: stableSortBy, quickFilter: filterUsed, signal: controller.signal }));
    } catch (error) {
      promise = Promise.reject(error);
    }
    promise.then(
      result => {
        if (!live) return;
        const { rows, totalCount } = normalize(result);
        setState({ lastGood: { rows, totalCount, start }, settled: queryKey, error: null });
      },
      error => {
        if (!live) return;
        if (isAbortError(error)) {
          // Nobody superseded this request, so the source aborted it itself;
          // not an error to show. Settle quietly on whatever was there.
          setState(prev => ({ ...prev, settled: queryKey, error: null }));
          return;
        }
        const err = toError(error);
        setState(prev => ({ ...prev, settled: queryKey, error: err }));
        aiBus.emit('datatable:load_error', { id: tableId, message: err.message });
      }
    );
    return () => {
      live = false;
      controller.abort();
    };
  }, [isSync, queryKey, source, start, count, stableSortBy, filterUsed, tableId]);

  const syncError = syncOutcome && 'error' in syncOutcome ? syncOutcome.error : null;
  useEffect(() => {
    if (syncError) aiBus.emit('datatable:load_error', { id: tableId, message: syncError.message });
  }, [syncError, tableId]);

  if (syncOutcome) {
    if ('error' in syncOutcome) return { rows: NO_ROWS, totalCount: null, rowsStart: start, status: 'error', error: syncOutcome.error, retry, isAsync: false };
    return { rows: syncOutcome.result.rows, totalCount: syncOutcome.result.totalCount, rowsStart: start, status: 'ready', error: null, retry, isAsync: false };
  }
  const rows = state.lastGood?.rows ?? NO_ROWS;
  const totalCount = state.lastGood?.totalCount ?? null;
  const rowsStart = state.lastGood?.start ?? start;
  if (state.settled !== queryKey) return { rows, totalCount, rowsStart, status: 'loading', error: null, retry, isAsync: true };
  return { rows, totalCount, rowsStart, status: state.error ? 'error' : 'ready', error: state.error, retry, isAsync: true };
}
