import { StrictMode } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { z } from 'zod';
import { DataTable, type Column } from '../components/DataTable/DataTable';
import type { DataTableDataSource, DataTableQuery, DataTableResult } from '../components/DataTable/dataSource';
import { BLOCK_SETTLE_MS } from '../components/DataTable/useDataSourceBlocks';
import { aiBus } from '../eventBus/eventBus';

// Issue #905, phase 2: <DataTable data={source} pagination={false}> virtualizes
// the data: the scroll area spans totalCount rows, blocks of rows are fetched
// for the visible window once scrolling settles, and rows not loaded yet are
// placeholders.

interface Item {
  id: number;
  name: string;
}

const columns: Column<Item>[] = [
  { key: 'id', title: 'ID', sortable: true },
  { key: 'name', title: 'Name', sortable: true },
];

const item = (n: number): Item => ({ id: n, name: `Item ${n}` });
const rowKey = (r: Item) => r.id;
const ITEM_HEIGHT = 40;
const TOTAL = 1000;
// containerHeight 400 / itemHeight 40 -> a window of 14 rows.
const WINDOW = 14;

interface Call {
  query: DataTableQuery;
  resolve: (result: DataTableResult<Item>) => void;
  reject: (error: unknown) => void;
}

function fakeSource() {
  const calls: Call[] = [];
  const source: DataTableDataSource<Item> = {
    getRows(query) {
      return new Promise<DataTableResult<Item>>((resolve, reject) => {
        calls.push({ query, resolve, reject });
      });
    },
  };
  return { source, calls };
}

/** Rows `start..start+count` of an `total`-row result set; item(n) sits at index n - 1. */
const rowsOf = (call: Call, total = TOTAL): Item[] =>
  Array.from({ length: Math.max(0, Math.min(call.query.count, total - call.query.start)) }, (_, i) => item(call.query.start + i + 1));

const answer = (call: Call, total = TOTAL) =>
  act(async () => {
    call.resolve({ rows: rowsOf(call, total), totalCount: total });
  });
const fail = (call: Call, message = 'boom') =>
  act(async () => {
    call.reject(new Error(message));
  });
const starts = (calls: Call[]) => calls.map(c => c.query.start);

const settle = () =>
  act(async () => {
    vi.advanceTimersByTime(BLOCK_SETTLE_MS);
  });

const bodyOf = () => screen.getByRole('grid').parentElement as HTMLElement;
const scrollTo = async (top: number) => {
  fireEvent.scroll(bodyOf(), { target: { scrollTop: top } });
  await act(async () => {
    await new Promise(resolve => requestAnimationFrame(resolve));
  });
};
const rowIndices = () => Array.from(screen.getByRole('grid').querySelectorAll('tbody tr[aria-rowindex]')).map(r => Number(r.getAttribute('aria-rowindex')));
const placeholders = () => screen.getByRole('grid').querySelectorAll('tbody tr[data-placeholder]');

function table(source: DataTableDataSource<Item>, extra: Record<string, any> = {}) {
  return (
    <DataTable
      id="vt"
      data={source}
      columns={columns}
      rowKey={rowKey}
      pagination={false}
      itemHeight={ITEM_HEIGHT}
      containerHeight={400}
      {...extra}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe('DataTable array data with pagination={false} (issue #905, phase 2)', () => {
  it('keeps the scroll position when the data array is replaced with a longer one', async () => {
    const make = (n: number) => Array.from({ length: n }, (_, i) => item(i + 1));
    const arrayTable = (data: Item[]) => (
      <DataTable id="at" data={data} columns={columns} rowKey={rowKey} pagination={false} itemHeight={ITEM_HEIGHT} containerHeight={400} />
    );
    const { rerender } = render(arrayTable(make(200)));
    await scrollTo(4000);
    const first = rowIndices()[0];
    expect(first).toBeGreaterThan(50);

    rerender(arrayTable(make(300)));
    await act(async () => {});
    expect(rowIndices()[0]).toBe(first);
  });
});

describe('DataTable data virtualization (issue #905, phase 2)', () => {
  it('asks for block 0 first, and shows a viewport of placeholders until the total is known', async () => {
    const { source, calls } = fakeSource();
    render(table(source));

    expect(calls).toHaveLength(1);
    expect(calls[0].query).toMatchObject({ start: 0, count: 100, sortBy: [], quickFilter: '' });
    expect(placeholders()).toHaveLength(WINDOW);
    expect(rowIndices().slice(0, 3)).toEqual([2, 3, 4]);
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '-1');
    expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'true');
    // No pagination footer in this mode.
    expect(screen.queryByLabelText('Next page')).not.toBeInTheDocument();
  });

  it('sizes the scroll area from totalCount and numbers every row by its absolute position', async () => {
    const { source, calls } = fakeSource();
    render(table(source));
    await answer(calls[0]);

    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', String(TOTAL + 1));
    expect(screen.getByRole('grid')).not.toHaveAttribute('aria-busy');
    expect(placeholders()).toHaveLength(0);
    expect(rowIndices()).toEqual(Array.from({ length: WINDOW }, (_, i) => i + 2));
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    // The bottom spacer plus the rendered rows add up to totalCount x row height.
    const spacer = screen.getByRole('grid').querySelector('tbody tr[aria-hidden="true"] td') as HTMLElement;
    expect(spacer.style.height).toBe(`${(TOTAL - WINDOW) * ITEM_HEIGHT}px`);
  });

  it('settle-then-fetch: no request while the window keeps moving, then only the blocks it lands on', async () => {
    const { source, calls } = fakeSource();
    render(table(source));
    await answer(calls[0]);
    expect(calls).toHaveLength(1);

    // A fling: the window keeps changing, each step inside the settle delay.
    for (const top of [4000, 9000, 15000, 22000, 25000]) {
      await scrollTo(top);
      await act(async () => {
        vi.advanceTimersByTime(BLOCK_SETTLE_MS - 20);
      });
    }
    expect(calls).toHaveLength(1);

    await settle();
    // Rows 623..637 plus 50 rows of overscan: blocks 5 and 6 only. Blocks 1-4
    // (and everything else the fling passed over) were never requested.
    expect(starts(calls)).toEqual([0, 500, 600]);
    expect(calls[1].query.count).toBe(100);
  });

  it('aborts requests for blocks the window has moved away from', async () => {
    const { source, calls } = fakeSource();
    render(table(source));
    await answer(calls[0]);

    await scrollTo(25000);
    await settle();
    expect(starts(calls)).toEqual([0, 500, 600]);

    await scrollTo(36000);
    await settle();
    expect(calls[1].query.signal.aborted).toBe(true);
    expect(calls[2].query.signal.aborted).toBe(true);
    expect(starts(calls).slice(3)).toEqual([800, 900]);
    expect(calls.slice(3).every(c => !c.query.signal.aborted)).toBe(true);
    // A late answer for an aborted block changes nothing and does not throw.
    await answer(calls[1]);
    expect(screen.queryByText('Item 501')).not.toBeInTheDocument();
  });

  it('shows placeholders at their real positions until the block arrives, then the rows', async () => {
    const { source, calls } = fakeSource();
    render(table(source));
    await answer(calls[0]);

    await scrollTo(25000);
    // Row 623 is at aria-rowindex 625 and nothing there is loaded yet.
    expect(rowIndices()[0]).toBe(625);
    expect(placeholders()).toHaveLength(WINDOW);
    expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'true');
    // Placeholder cells carry only decorative Skeletons.
    expect(placeholders()[0].querySelector('[aria-hidden="true"]')).not.toBeNull();

    await settle();
    await answer(calls[1]);
    await answer(calls[2]);
    expect(placeholders()).toHaveLength(0);
    expect(screen.getByText('Item 624')).toBeInTheDocument();
    expect(screen.getByRole('grid')).not.toHaveAttribute('aria-busy');
  });

  it('a failed block becomes an error row with Retry, and emits datatable:load_error once', async () => {
    const errors: string[] = [];
    const off = aiBus.on('datatable:load_error', p => errors.push(p.message));
    const { source, calls } = fakeSource();
    render(table(source));
    await answer(calls[0]);

    await scrollTo(25000);
    await settle();
    // Rows 623..637 are all in block 6 (600..699); block 5 is only overscan.
    await answer(calls[1]);
    await fail(calls[2], 'block 6 failed');

    expect(errors).toEqual(['block 6 failed']);
    const errorRows = screen.getByRole('grid').querySelectorAll('tbody tr[data-block-error]');
    expect(errorRows.length).toBeGreaterThan(0);
    expect(errorRows[0]).toHaveAttribute('aria-rowindex', '625');
    // One Retry for the block, not one per row.
    const retry = screen.getByRole('button', { name: 'Retry' });
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);

    fireEvent.click(retry);
    expect(calls).toHaveLength(4);
    expect(calls[3].query.start).toBe(600);
    await answer(calls[3]);
    expect(screen.getByText('Item 624')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    off();
  });

  it('a later block reporting a different totalCount updates the scroll area', async () => {
    const { source, calls } = fakeSource();
    render(table(source));
    await answer(calls[0]);
    await scrollTo(25000);
    await settle();
    await answer(calls[1], 900);
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '901');
  });

  it('keeps at most maxCachedBlocks, releasing the least recently used', async () => {
    const { source, calls } = fakeSource();
    render(table(source, { maxCachedBlocks: 2 }));
    await answer(calls[0]);

    const visit = async (top: number) => {
      const before = calls.length;
      await scrollTo(top);
      await settle();
      for (const call of calls.slice(before)) await answer(call);
    };
    await visit(25000); // blocks 5, 6
    await visit(36000); // blocks 8, 9 -> 5 and 6 are released
    const before = calls.length;
    await visit(25000);
    // Back at the first window: both blocks had to be fetched again.
    expect(starts(calls).slice(before)).toEqual([500, 600]);
    // Staying put needs nothing new.
    await settle();
    expect(calls).toHaveLength(before + 2);
  });

  it('never releases a block holding a row being edited', async () => {
    const { source, calls } = fakeSource();
    const editSchema = z.object({ id: z.number(), name: z.string() });
    render(
      table(source, {
        maxCachedBlocks: 2,
        editable: true,
        editSchema,
        editingKeys: ['5'],
        onEditingKeysChange: () => {},
      })
    );
    await answer(calls[0]);

    const visit = async (top: number) => {
      const before = calls.length;
      await scrollTo(top);
      await settle();
      for (const call of calls.slice(before)) await answer(call);
    };
    await visit(25000);
    await visit(36000);
    await visit(0);
    // Block 0 holds item 5 (key '5'): still cached, so going home asked for nothing.
    expect(calls.filter(c => c.query.start === 0)).toHaveLength(1);
    expect(screen.getAllByText('Item 5').length).toBeGreaterThan(0);
  });

  it('a sort change starts over: aborts everything, refetches block 0 with the new sort, and returns to the top', async () => {
    const { source, calls } = fakeSource();
    render(table(source));
    await answer(calls[0]);
    await scrollTo(25000);
    await settle();
    expect(calls).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(calls[1].query.signal.aborted).toBe(true);
    expect(calls[2].query.signal.aborted).toBe(true);
    const fresh = calls[calls.length - 1];
    expect(fresh.query.start).toBe(0);
    expect(fresh.query.sortBy).toEqual([{ key: 'name', direction: 'asc' }]);
    // Window is back at the top: placeholders from row index 2.
    expect(rowIndices()[0]).toBe(2);
  });

  it('a quick-filter change (debounced) refetches block 0 with the filter', async () => {
    const { source, calls } = fakeSource();
    render(table(source, { quickFilter: true }));
    await answer(calls[0]);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'abc' } });
    expect(calls).toHaveLength(1);
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    const fresh = calls[calls.length - 1];
    expect(fresh.query).toMatchObject({ start: 0, quickFilter: 'abc' });
  });

  it('datatable:refresh clears the cache and refetches block 0', async () => {
    const { source, calls } = fakeSource();
    render(table(source));
    await answer(calls[0]);
    expect(screen.getByText('Item 1')).toBeInTheDocument();

    act(() => {
      aiBus.emit('datatable:refresh', { id: 'vt' });
    });
    expect(calls).toHaveLength(2);
    expect(calls[1].query.start).toBe(0);
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
    await answer(calls[1]);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('Ctrl+End moves focus to the last row, a placeholder, and keeps it there when the row arrives', async () => {
    const { source, calls } = fakeSource();
    render(table(source));
    await answer(calls[0]);

    fireEvent.keyDown(screen.getByRole('grid'), { key: 'End', ctrlKey: true });
    // jsdom has no layout: do what the browser would after the scroll write.
    await scrollTo((TOTAL - 1) * ITEM_HEIGHT);

    const focused = document.activeElement as HTMLElement;
    expect(focused).toHaveAttribute('data-grid-row', String(TOTAL));
    const row = focused.closest('tr') as HTMLElement;
    expect(row).toHaveAttribute('aria-rowindex', String(TOTAL + 1));
    expect(row).toHaveAttribute('data-placeholder', 'true');

    await settle();
    const lastBlock = calls.filter(c => c.query.start === 900);
    expect(lastBlock).toHaveLength(1);
    await answer(lastBlock[0]);
    // The same absolute row and cell, now with its data, still focused.
    expect(document.activeElement).toBe(focused);
    expect(within(row).getByText(`Item ${TOTAL}`)).toBeInTheDocument();
    expect(row).not.toHaveAttribute('data-placeholder');
  });

  it('does not fire onEndReached for a data source', async () => {
    const onEndReached = vi.fn();
    const { source, calls } = fakeSource();
    render(table(source, { onEndReached }));
    await answer(calls[0]);
    await scrollTo((TOTAL - 1) * ITEM_HEIGHT);
    expect(onEndReached).not.toHaveBeenCalled();
  });

  it('never calls getRows during render (requests only come from effects)', async () => {
    let rendering = false;
    const calledDuringRender: DataTableQuery[] = [];
    const calls: Call[] = [];
    const source: DataTableDataSource<Item> = {
      getRows(query) {
        if (rendering) calledDuringRender.push(query);
        return new Promise<DataTableResult<Item>>((resolve, reject) => {
          calls.push({ query, resolve, reject });
        });
      },
    };
    const Begin = () => {
      rendering = true;
      return null;
    };
    const End = () => {
      rendering = false;
      return null;
    };
    const tree = (
      <>
        <Begin />
        {table(source, { quickFilter: true })}
        <End />
      </>
    );
    const { rerender } = render(tree);
    await answer(calls[0]);
    await scrollTo(25000);
    await settle();
    rerender(tree);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'x' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(calls.length).toBeGreaterThan(1);
    expect(calledDuringRender).toEqual([]);
  });

  it('Space selects the focused row by its absolute position, not its index in the cached rows', async () => {
    const { source, calls } = fakeSource();
    const onSelectionChange = vi.fn();
    render(table(source, { selectable: true, onSelectionChange }));
    await answer(calls[0]);

    const visit = async (top: number) => {
      const before = calls.length;
      await scrollTo(top);
      await settle();
      for (const call of calls.slice(before)) await answer(call);
    };
    await visit(25000); // blocks 5, 6
    await visit(12800); // blocks 2, 3 -> cache is 0, 2, 3, 5, 6: 500 rows with gaps
    // Item 321 sits at absolute index 320; the 321st cached row is item 521.
    const cell = screen.getByRole('grid').querySelector('td[data-grid-row="321"]') as HTMLElement;
    expect(cell).not.toBeNull();
    expect(within(cell.closest('tr') as HTMLElement).getByText('Item 321')).toBeInTheDocument();
    act(() => {
      cell.focus();
    });
    fireEvent.keyDown(cell, { key: ' ' });
    expect(onSelectionChange).toHaveBeenLastCalledWith(['321']);
  });

  it('under StrictMode the first block 0 request is aborted and one live request remains', async () => {
    const { source, calls } = fakeSource();
    render(<StrictMode>{table(source)}</StrictMode>);
    await act(async () => {});
    expect(calls).toHaveLength(2);
    expect(calls[0].query.signal.aborted).toBe(true);
    expect(calls[1].query.signal.aborted).toBe(false);
    await answer(calls[1]);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });
});
