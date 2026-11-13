/**
 * The pure arithmetic behind data virtualization's block cache (issue #905,
 * phase 2): which blocks a window of rows needs, and which cached blocks to
 * drop. Kept free of React and of any request so it can be unit-tested
 * directly; `useDataSourceBlocks` owns the requests.
 */

/**
 * The block indices that cover rows `[start, end)`, in ascending order.
 * Rows below 0 are ignored, and, when the total is known, so are blocks
 * past the last row.
 */
export function blocksCovering(start: number, end: number, blockSize: number, totalCount: number | null): number[] {
  const first = Math.floor(Math.max(0, start) / blockSize);
  let lastRow = end - 1;
  if (totalCount !== null) lastRow = Math.min(lastRow, totalCount - 1);
  if (lastRow < Math.max(0, start)) return [];
  const last = Math.floor(lastRow / blockSize);
  const blocks: number[] = [];
  for (let b = first; b <= last; b++) blocks.push(b);
  return blocks;
}

export interface PlanEvictionsOptions {
  /** Cached ready blocks, least recently used first. */
  lruOrder: readonly number[];
  /** Whether a block must not be evicted (it is in the current window, or holds a pinned row). */
  keep: (block: number) => boolean;
  /** The most ready blocks to hold on to. */
  maxCached: number;
}

/**
 * The blocks to evict, least recently used first, so that no more than
 * `maxCached` remain. A kept block is skipped even when that leaves more
 * than `maxCached` in the cache: keeping the visible rows and the rows
 * being edited outranks the bound.
 */
export function planEvictions({ lruOrder, keep, maxCached }: PlanEvictionsOptions): number[] {
  const evict: number[] = [];
  let count = lruOrder.length;
  for (const block of lruOrder) {
    if (count <= maxCached) break;
    if (keep(block)) continue;
    evict.push(block);
    count--;
  }
  return evict;
}
