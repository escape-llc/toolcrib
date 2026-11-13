'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { aiBus } from '../../eventBus/eventBus';
import type { SortDescriptor } from './DataTable';
import type { DataTableDataSource, DataTableResult } from './dataSource';
import { blocksCovering, planEvictions } from './blockCache';

/** Rows requested per block, unless `blockSize` says otherwise. */
export const DEFAULT_BLOCK_SIZE = 100;
/** Blocks kept in the cache, unless `maxCachedBlocks` says otherwise. */
export const DEFAULT_MAX_CACHED_BLOCKS = 10;
/** How long the visible window must hold still before the blocks it needs are requested. */
export const BLOCK_SETTLE_MS = 120;
/** Rows beyond each edge of the visible window that are fetched along with it. */
export const DEFAULT_OVERSCAN_ROWS = 50;

/** What sits at one absolute row index of a virtualized table. */
export type BlockSlot<T> = { kind: 'row'; row: T } | { kind: 'placeholder' } | { kind: 'error'; blockIndex: number };

interface BlockEntry<T> {
  status: 'loading' | 'ready' | 'error';
  rows?: T[];
  controller?: AbortController;
}

interface BlockQuery<T> {
  source: DataTableDataSource<T>;
  sortBy: SortDescriptor[];
  quickFilter: string;
  blockSize: number;
  tableId: string;
}

const NO_KEYS: ReadonlySet<string> = new Set();

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { name?: unknown }).name === 'AbortError';
}

/**
 * The block cache and its requests, outside React so a request's result can
 * land whenever it likes; `useDataSourceBlocks` subscribes to `version`.
 * Every method that calls the source is only ever called from an effect,
 * never from render.
 */
export class BlockStore<T> {
  private cache = new Map<number, BlockEntry<T>>();
  private listeners = new Set<() => void>();
  private query: BlockQuery<T> | null = null;
  private lastSource: DataTableDataSource<T> | null = null;
  private keepBlocks = new Set<number>();
  private pinned: ReadonlySet<string> = NO_KEYS;
  private rowKey: ((record: T, index: number) => string | number) | undefined;
  private maxCached = DEFAULT_MAX_CACHED_BLOCKS;
  private blockSize = DEFAULT_BLOCK_SIZE;
  version = 0;
  /** Counts `start` calls, so the window effect can re-arm after a query change that left the window where it was. */
  epoch = 0;
  totalCount: number | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getVersion = (): number => this.version;

  private bump() {
    this.version++;
    this.listeners.forEach(l => l());
  }

  /** Aborts every request and forgets every block. */
  stop() {
    for (const entry of this.cache.values()) entry.controller?.abort();
    this.cache.clear();
    this.keepBlocks = new Set();
    this.query = null;
  }

  /** Starts over for `query`: clears the cache and requests block 0, whose `totalCount` sizes the scroll area. */
  start(query: BlockQuery<T>) {
    this.stop();
    if (this.lastSource !== query.source) this.totalCount = null;
    this.lastSource = query.source;
    this.query = query;
    this.epoch++;
    this.blockSize = query.blockSize;
    this.keepBlocks = new Set([0]);
    this.requestBlock(0);
    this.bump();
  }

  setPinned(keys: ReadonlySet<string>, rowKey: ((record: T, index: number) => string | number) | undefined) {
    this.pinned = keys;
    this.rowKey = rowKey;
    if (this.evict()) this.bump();
  }

  /**
   * The visible window has settled: request the blocks covering it (plus
   * `overscan` rows each side), abort requests for blocks it no longer
   * needs, and evict what exceeds `maxCachedBlocks`.
   */
  setWindow(start: number, end: number, overscan: number, maxCachedBlocks: number) {
    const query = this.query;
    if (!query) return;
    // Before the first answer the total is unknown, so only block 0 (already
    // requested by `start`) is worth asking for.
    const needed = this.totalCount === null ? [0] : blocksCovering(start - overscan, end + overscan, query.blockSize, this.totalCount);
    this.maxCached = Math.max(maxCachedBlocks, needed.length);
    this.keepBlocks = new Set(needed);
    let changed = false;
    for (const [block, entry] of [...this.cache]) {
      if (this.keepBlocks.has(block)) continue;
      if (entry.status === 'loading' || entry.status === 'error') {
        entry.controller?.abort();
        this.cache.delete(block);
        changed = true;
      }
    }
    for (const block of needed) {
      const entry = this.cache.get(block);
      if (!entry) {
        this.requestBlock(block);
        changed = true;
      } else if (entry.status === 'ready') {
        // Touch: most recently used goes last.
        this.cache.delete(block);
        this.cache.set(block, entry);
      }
    }
    if (this.evict()) changed = true;
    if (changed) this.bump();
  }

  retryBlock(block: number) {
    if (this.cache.get(block)?.status !== 'error') return;
    this.cache.delete(block);
    this.keepBlocks.add(block);
    this.requestBlock(block);
    this.bump();
  }

  private requestBlock(block: number) {
    const query = this.query;
    if (!query) return;
    const controller = new AbortController();
    const entry: BlockEntry<T> = { status: 'loading', controller };
    this.cache.set(block, entry);
    let promise: Promise<DataTableResult<T>>;
    try {
      promise = Promise.resolve(
        query.source.getRows({
          start: block * query.blockSize,
          count: query.blockSize,
          sortBy: query.sortBy,
          quickFilter: query.quickFilter,
          signal: controller.signal,
        })
      );
    } catch (error) {
      promise = Promise.reject(error);
    }
    promise.then(
      result => {
        // Superseded (aborted, evicted, or the query changed): ignore, even
        // when the source ignored `signal` and resolved anyway.
        if (this.cache.get(block) !== entry) return;
        const total = Number.isFinite(result.totalCount) ? result.totalCount : block * query.blockSize + result.rows.length;
        this.totalCount = total;
        this.cache.set(block, { status: 'ready', rows: result.rows });
        this.evict();
        this.bump();
      },
      error => {
        if (this.cache.get(block) !== entry) return;
        if (isAbortError(error)) {
          // Nobody superseded this request, so the source aborted it itself;
          // not an error to show. Forget it; scrolling back asks again.
          this.cache.delete(block);
          this.bump();
          return;
        }
        this.cache.set(block, { status: 'error' });
        this.bump();
        const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Failed to load rows';
        aiBus.emit('datatable:load_error', { id: query.tableId, message });
      }
    );
  }

  private holdsPinnedRow(block: number, rows: T[]): boolean {
    if (this.pinned.size === 0 || !this.rowKey) return false;
    const rowKey = this.rowKey;
    return rows.some((row, i) => this.pinned.has(String(rowKey(row, block * this.blockSize + i))));
  }

  /** Drops least-recently-used ready blocks beyond the bound, never a window block or one holding a pinned row. */
  private evict(): boolean {
    const lruOrder = [...this.cache].filter(([, e]) => e.status === 'ready').map(([b]) => b);
    const victims = planEvictions({
      lruOrder,
      keep: block => this.keepBlocks.has(block) || this.holdsPinnedRow(block, this.cache.get(block)?.rows ?? []),
      maxCached: this.maxCached,
    });
    for (const block of victims) this.cache.delete(block);
    return victims.length > 0;
  }

  getRow(index: number): BlockSlot<T> {
    const block = Math.floor(index / this.blockSize);
    const entry = this.cache.get(block);
    if (entry?.status === 'error') return { kind: 'error', blockIndex: block };
    const row = entry?.status === 'ready' ? entry.rows?.[index - block * this.blockSize] : undefined;
    return row === undefined ? { kind: 'placeholder' } : { kind: 'row', row };
  }

  /** Whether any row of `[start, end)` is still waiting for its block (or the total is unknown). */
  isWindowLoading(start: number, end: number): boolean {
    if (this.totalCount === null) return true;
    return blocksCovering(start, end, this.blockSize, this.totalCount).some(b => {
      const status = this.cache.get(b)?.status;
      return status !== 'ready' && status !== 'error';
    });
  }

  /** Every row currently cached, in index order. */
  loadedRows(): T[] {
    return [...this.cache]
      .filter(([, e]) => e.status === 'ready')
      .sort(([a], [b]) => a - b)
      .flatMap(([, e]) => e.rows ?? []);
  }
}

export interface UseDataSourceBlocksOptions<T> {
  source: DataTableDataSource<T>;
  /** False when the table isn't virtualizing a data source: no request is ever made. */
  enabled: boolean;
  blockSize: number;
  sortBy: SortDescriptor[];
  /** The committed (already debounced) quick-filter text. */
  quickFilter: string;
  /** Changing this clears the cache and requests block 0 again (`datatable:refresh`). */
  refreshNonce: number;
  tableId: string;
}

export interface UseDataSourceBlocksResult<T> {
  /** The size of the whole result set. `null` until block 0 has answered. */
  totalCount: number | null;
  /** What sits at an absolute row index: a loaded row, a placeholder, or a failed block. */
  getRow: (index: number) => BlockSlot<T>;
  /** Every row currently cached, in index order. */
  loadedRows: T[];
  /** Whether a row of `[start, end)` is still waiting for its block. */
  isWindowLoading: (start: number, end: number) => boolean;
  /** Re-requests a failed block. */
  retryBlock: (blockIndex: number) => void;
  /** Increments each time the cache starts over. */
  epoch: number;
  /** @internal The store `useBlockWindow` drives. */
  store: BlockStore<T>;
}

/**
 * Data virtualization's data layer (issue #905, phase 2): a bounded LRU
 * cache of fixed-size blocks of rows from a data source, requested one
 * block at a time (`getRows({ start: block * blockSize, count: blockSize })`)
 * from effects only, each with its own `AbortController`. Block 0 is asked
 * for first, since its `totalCount` sizes the scroll area. A sort or
 * quick-filter change, a new source, or `refreshNonce` aborts everything,
 * clears the cache and asks for block 0 again. Which other blocks to ask
 * for follows the visible window: see `useBlockWindow`.
 */
export function useDataSourceBlocks<T>({
  source,
  enabled,
  blockSize,
  sortBy,
  quickFilter,
  refreshNonce,
  tableId,
}: UseDataSourceBlocksOptions<T>): UseDataSourceBlocksResult<T> {
  const [store] = useState(() => new BlockStore<T>());
  const version = useSyncExternalStore(store.subscribe, store.getVersion, store.getVersion);

  const sortKey = sortBy.map(d => `${d.key}:${d.direction}`).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sortKey stands in for sortBy's content.
  const stableSortBy = useMemo(() => sortBy, [sortKey]);

  useEffect(() => {
    if (!enabled) return;
    store.start({ source, sortBy: stableSortBy, quickFilter, blockSize, tableId });
    return () => store.stop();
  }, [store, enabled, source, stableSortBy, quickFilter, blockSize, tableId, refreshNonce]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the store's change signal.
  const loadedRows = useMemo(() => store.loadedRows(), [store, version]);

  return {
    totalCount: enabled ? store.totalCount : null,
    getRow: index => store.getRow(index),
    loadedRows,
    isWindowLoading: (start, end) => store.isWindowLoading(start, end),
    retryBlock: block => store.retryBlock(block),
    epoch: store.epoch,
    store,
  };
}

export interface UseBlockWindowOptions<T> {
  enabled: boolean;
  /** First visible row index (absolute). */
  visibleStart: number;
  /** One past the last visible row index. */
  visibleEnd: number;
  overscan?: number;
  maxCachedBlocks: number;
  /** Keys of rows that must stay cached (rows being edited). */
  pinnedKeys: ReadonlySet<string>;
  rowKey: ((record: T, index: number) => string | number) | undefined;
}

/**
 * Settle-then-fetch: when the visible window changes, waits until it has
 * held still for `BLOCK_SETTLE_MS`, then requests only the blocks covering
 * it (plus overscan) and aborts requests for blocks it moved away from. A
 * fling to the bottom therefore fetches the landing blocks, never the ones
 * it passed over. Also keeps the cache's pinned keys current.
 */
export function useBlockWindow<T>(
  { store, totalCount, epoch }: Pick<UseDataSourceBlocksResult<T>, 'store' | 'totalCount' | 'epoch'>,
  { enabled, visibleStart, visibleEnd, overscan = DEFAULT_OVERSCAN_ROWS, maxCachedBlocks, pinnedKeys, rowKey }: UseBlockWindowOptions<T>
) {
  useEffect(() => {
    if (enabled) store.setPinned(pinnedKeys, rowKey);
  }, [store, enabled, pinnedKeys, rowKey]);

  useEffect(() => {
    if (!enabled) return;
    const timeoutId = setTimeout(() => store.setWindow(visibleStart, visibleEnd, overscan, maxCachedBlocks), BLOCK_SETTLE_MS);
    return () => clearTimeout(timeoutId);
    // `totalCount` re-arms this once block 0 has sized the scroll area, and
    // `epoch` after a query change that left the window where it was.
  }, [store, enabled, visibleStart, visibleEnd, overscan, maxCachedBlocks, totalCount, epoch]);
}
