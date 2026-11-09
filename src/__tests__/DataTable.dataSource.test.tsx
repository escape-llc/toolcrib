import { StrictMode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import { DataTable, type Column } from '../components/DataTable/DataTable';
import { createArrayDataSource, type DataTableDataSource, type DataTableQuery, type DataTableResult } from '../components/DataTable/dataSource';
import { aiBus } from '../eventBus/eventBus';

// Issue #905, phase 1: <DataTable data={source}> asks a data source for a
// range of rows instead of sorting/filtering/slicing an array itself.

interface Item {
  id: number;
  name: string;
}

const columns: Column<Item>[] = [
  { key: 'id', title: 'ID', sortable: true },
  { key: 'name', title: 'Name', sortable: true },
];

const item = (n: number): Item => ({ id: n, name: `Item ${n}` });
const itemsFrom = (first: number, count: number): Item[] => Array.from({ length: count }, (_, i) => item(first + i));
const rowKey = (r: Item) => r.id;

interface Call {
  query: DataTableQuery;
  resolve: (result: DataTableResult<Item>) => void;
  reject: (error: unknown) => void;
}

/** A source whose every request is a pending Promise the test settles by hand. */
function fakeSource(extra: Partial<DataTableDataSource<Item>> = {}) {
  const calls: Call[] = [];
  const source: DataTableDataSource<Item> = {
    getRows(query) {
      return new Promise<DataTableResult<Item>>((resolve, reject) => {
        calls.push({ query, resolve, reject });
      });
    },
    ...extra,
  };
  return { source, calls };
}

const answer = (call: Call, rows: Item[], totalCount: number) =>
  act(async () => {
    call.resolve({ rows, totalCount });
  });

const flush = () => act(async () => {});

const nextPage = () => fireEvent.click(screen.getByLabelText('Next page'));

afterEach(() => {
  vi.useRealTimers();
});

describe('DataTable with a data source (issue #905)', () => {
  it('asks for the first page with the table state, and renders the rows as returned', async () => {
    const { source, calls } = fakeSource();
    render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);

    expect(calls).toHaveLength(1);
    expect(calls[0].query).toMatchObject({ start: 0, count: 10, sortBy: [], quickFilter: '' });
    expect(calls[0].query.signal).toBeInstanceOf(AbortSignal);
    expect(calls[0].query.signal.aborted).toBe(false);

    // Deliberately NOT in id order: the table must show exactly what came back.
    await answer(calls[0], [item(30), item(5), item(20)], 3);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map(r => within(r).getAllByRole('cell')[1].textContent)).toEqual(['Item 30', 'Item 5', 'Item 20']);
  });

  it('takes the page count, footer and aria-rowcount from totalCount, not the loaded rows', async () => {
    const { source, calls } = fakeSource();
    render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
    // Unknown total until the first answer.
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '-1');

    await answer(calls[0], itemsFrom(1, 10), 1234);
    expect(screen.getByText('Showing 1 to 10 of 1234 entries')).toBeInTheDocument();
    expect(screen.getByText('1 / 124')).toBeInTheDocument();
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '1235');
    expect((screen.getByLabelText('Next page') as HTMLButtonElement).disabled).toBe(false);
  });

  it('requests the next page with start = pageSize, and keeps the previous rows (aria-busy) while it loads', async () => {
    const { source, calls } = fakeSource();
    render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
    expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'true');
    await answer(calls[0], itemsFrom(1, 10), 50);
    expect(screen.getByRole('grid')).not.toHaveAttribute('aria-busy');

    nextPage();
    expect(calls).toHaveLength(2);
    expect(calls[1].query.start).toBe(10);
    // Still showing page 1's rows, flagged busy, until page 2 arrives.
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'true');

    await answer(calls[1], itemsFrom(11, 10), 50);
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
    expect(screen.getByText('Item 11')).toBeInTheDocument();
    expect(screen.getByText('Showing 11 to 20 of 50 entries')).toBeInTheDocument();
    expect(screen.getByRole('grid')).not.toHaveAttribute('aria-busy');
  });

  describe('stale rows while the requested page is loading or failed', () => {
    const tbody = () => screen.getByRole('grid').querySelector('tbody') as HTMLElement;

    it('the footer describes the rows on screen, and the rows are dimmed until the new page settles', async () => {
      const { source, calls } = fakeSource();
      render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
      // First load: no rows yet, so nothing to dim.
      expect(tbody()).not.toHaveAttribute('data-stale');
      await answer(calls[0], itemsFrom(1, 10), 50);
      expect(tbody()).not.toHaveAttribute('data-stale');

      nextPage();
      // Requested page 2, still showing page 1's rows.
      expect(screen.getByText('2 / 5')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Showing 1 to 10 of 50 entries');
      expect(tbody()).toHaveAttribute('data-stale', 'true');
      expect(tbody().style.opacity).toContain('--ai-datatable-stale-opacity');
      expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'true');

      await answer(calls[1], itemsFrom(11, 10), 50);
      expect(screen.getByRole('status')).toHaveTextContent('Showing 11 to 20 of 50 entries');
      expect(tbody()).not.toHaveAttribute('data-stale');
      expect(tbody().style.opacity).toBe('');
    });

    it('after a failed page load the footer still describes the shown rows, and they stay dimmed', async () => {
      const { source, calls } = fakeSource();
      render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
      await answer(calls[0], itemsFrom(1, 10), 50);
      nextPage();
      await answer(calls[1], itemsFrom(11, 10), 50);
      nextPage();
      await act(async () => {
        calls[2].reject(new Error('boom'));
      });
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('3 / 5')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Showing 11 to 20 of 50 entries');
      expect(tbody()).toHaveAttribute('data-stale', 'true');
      expect(screen.getByRole('grid')).not.toHaveAttribute('aria-busy');
    });

    it('Previous from a failed page requests the page before it and loads', async () => {
      const { source, calls } = fakeSource();
      render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
      await answer(calls[0], itemsFrom(1, 10), 50);
      nextPage();
      await answer(calls[1], itemsFrom(11, 10), 50);
      nextPage();
      await act(async () => {
        calls[2].reject(new Error('boom'));
      });
      expect(calls[2].query.start).toBe(20);

      fireEvent.click(screen.getByLabelText('Previous page'));
      expect(calls).toHaveLength(4);
      expect(calls[3].query.start).toBe(10);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      await answer(calls[3], itemsFrom(11, 10), 50);
      expect(screen.getByText('2 / 5')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Showing 11 to 20 of 50 entries');
      expect(tbody()).not.toHaveAttribute('data-stale');
    });

    it('an array source is never dimmed', () => {
      render(<DataTable data={itemsFrom(1, 25)} columns={columns} defaultPageSize={10} />);
      nextPage();
      expect(tbody()).not.toHaveAttribute('data-stale');
      expect(tbody().style.opacity).toBe('');
      expect(screen.getByRole('status')).toHaveTextContent('Showing 11 to 20 of 25 entries');
    });
  });

  it('a sort click requests the new sort and returns to the first page', async () => {
    const { source, calls } = fakeSource();
    render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
    await answer(calls[0], itemsFrom(1, 10), 50);
    nextPage();
    await answer(calls[1], itemsFrom(11, 10), 50);
    expect(calls[1].query.start).toBe(10);

    fireEvent.click(screen.getByRole('button', { name: /^Name/ }));
    const sortCall = calls[calls.length - 1];
    expect(sortCall.query).toMatchObject({ start: 0, count: 10, sortBy: [{ key: 'name', direction: 'asc' }] });
    // One request for the sort, not one for the old page first.
    expect(calls).toHaveLength(3);
  });

  it('typing in the quick filter makes ONE request, after the debounce, from page 1', async () => {
    vi.useFakeTimers();
    const { source, calls } = fakeSource();
    render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} quickFilter />);
    await answer(calls[0], itemsFrom(1, 10), 50);
    nextPage();
    await answer(calls[1], itemsFrom(11, 10), 50);
    const before = calls.length;

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'i' } });
    fireEvent.change(input, { target: { value: 'it' } });
    fireEvent.change(input, { target: { value: 'ite' } });
    // Nothing is requested while typing, and the page doesn't jump yet.
    await act(async () => {
      vi.advanceTimersByTime(249);
    });
    expect(calls).toHaveLength(before);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(calls).toHaveLength(before + 1);
    expect(calls[before].query).toMatchObject({ start: 0, count: 10, quickFilter: 'ite' });
  });

  it('aborts a superseded request and ignores its late resolution', async () => {
    const { source, calls } = fakeSource();
    render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
    await answer(calls[0], itemsFrom(1, 10), 50);

    nextPage();
    expect(calls[1].query.signal.aborted).toBe(false);
    // Superseded before it answers.
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(calls).toHaveLength(3);
    expect(calls[1].query.signal.aborted).toBe(true);
    expect(calls[2].query.start).toBe(20);

    // The source ignored the signal and answered the old request anyway.
    await answer(calls[1], itemsFrom(11, 10), 50);
    expect(screen.queryByText('Item 11')).not.toBeInTheDocument();
    expect(screen.getByRole('grid')).toHaveAttribute('aria-busy', 'true');

    await answer(calls[2], itemsFrom(21, 10), 50);
    expect(screen.getByText('Item 21')).toBeInTheDocument();
    expect(screen.getByText('Showing 21 to 30 of 50 entries')).toBeInTheDocument();
  });

  it('aborts the in-flight request when the table unmounts', async () => {
    const { source, calls } = fakeSource();
    const { unmount } = render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
    expect(calls[0].query.signal.aborted).toBe(false);
    unmount();
    expect(calls[0].query.signal.aborted).toBe(true);
    // Settling afterwards must not blow up (no setState on an unmounted table).
    await answer(calls[0], itemsFrom(1, 10), 10);
  });

  it('under StrictMode the first request is aborted and exactly one live request remains', async () => {
    const { source, calls } = fakeSource();
    render(
      <StrictMode>
        <DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />
      </StrictMode>
    );
    await flush();
    // Mount, cleanup, mount: two requests, the first aborted by the cleanup.
    expect(calls).toHaveLength(2);
    expect(calls[0].query.signal.aborted).toBe(true);
    expect(calls[1].query.signal.aborted).toBe(false);
    await answer(calls[1], itemsFrom(1, 10), 10);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByRole('grid')).not.toHaveAttribute('aria-busy');
  });

  it('never calls getRows during render for a custom source (render must not start requests)', async () => {
    // <Begin/> and <End/> bracket <DataTable/>'s own render within one pass,
    // so a getRows call made from the table's render body or its hooks sees
    // `rendering === true`; a call from an effect (after the pass) does not.
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
        <DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} quickFilter />
        <End />
      </>
    );
    const { rerender } = render(tree);
    await answer(calls[0], itemsFrom(1, 10), 50);
    nextPage();
    await answer(calls[1], itemsFrom(11, 10), 50);
    rerender(tree);
    fireEvent.click(screen.getByRole('button', { name: /^Name/ }));
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(calledDuringRender).toEqual([]);
  });

  it('shows a neutral loading footer before the first answer, never a huge total or page count', async () => {
    const { source, calls } = fakeSource();
    render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
    const footer = screen.getByRole('status');
    expect(footer).toHaveTextContent('Loading…');
    expect(document.body.textContent).not.toMatch(/9007199254740991|\d{6,}/);
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect((screen.getByLabelText('Next page') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Last page') as HTMLButtonElement).disabled).toBe(true);
    await answer(calls[0], itemsFrom(1, 10), 50);
    expect(footer).toHaveTextContent('Showing 1 to 10 of 50 entries');
  });

  describe('errors', () => {
    it('shows a banner with Retry, keeps the previous rows, and emits datatable:load_error', async () => {
      const onError = vi.fn();
      const unsub = aiBus.on('datatable:load_error', onError);
      const { source, calls } = fakeSource();
      render(<DataTable id="orders" data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
      await answer(calls[0], itemsFrom(1, 10), 50);

      nextPage();
      await act(async () => {
        calls[1].reject(new Error('boom'));
      });
      const banner = screen.getByRole('alert');
      expect(banner).toHaveTextContent('Could not load rows.');
      expect(onError).toHaveBeenCalledWith({ id: 'orders', message: 'boom' });
      // The previous page stays visible beneath the banner.
      expect(screen.getByText('Item 1')).toBeInTheDocument();

      fireEvent.click(within(banner).getByRole('button', { name: 'Retry' }));
      expect(calls).toHaveLength(3);
      expect(calls[2].query.start).toBe(10);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      await answer(calls[2], itemsFrom(11, 10), 50);
      expect(screen.getByText('Item 11')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      unsub();
    });

    it('an error thrown synchronously is an error state too', async () => {
      const source: DataTableDataSource<Item> = {
        getRows() {
          throw new Error('sync boom');
        },
      };
      render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
      await flush();
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load rows.');
    });

    it('an AbortError never shows the banner', async () => {
      const onError = vi.fn();
      const unsub = aiBus.on('datatable:load_error', onError);
      const { source, calls } = fakeSource();
      render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
      await answer(calls[0], itemsFrom(1, 10), 50);

      nextPage();
      // The superseded request rejects with the AbortError a real fetch would.
      nextPage();
      await act(async () => {
        calls[1].reject(new DOMException('aborted', 'AbortError'));
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(onError).not.toHaveBeenCalled();

      // Even one the source aborts itself, with nobody superseding it.
      await act(async () => {
        calls[2].reject(new DOMException('aborted', 'AbortError'));
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('grid')).not.toHaveAttribute('aria-busy');
      expect(onError).not.toHaveBeenCalled();
      unsub();
    });
  });

  describe('capabilities', () => {
    it('hides the Export CSV button without exportRows', async () => {
      const { source, calls } = fakeSource();
      render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} csvExport />);
      await answer(calls[0], itemsFrom(1, 10), 10);
      expect(screen.queryByLabelText('Export CSV')).not.toBeInTheDocument();
    });

    it('shows Export CSV with exportRows, calls it with the current sort and filter, and awaits it', async () => {
      const createObjectURL = vi.fn(() => 'blob:test');
      const originalCreate = URL.createObjectURL;
      const originalRevoke = URL.revokeObjectURL;
      URL.createObjectURL = createObjectURL;
      URL.revokeObjectURL = vi.fn();
      const exported = vi.fn();
      const unsub = aiBus.on('datatable:exported', exported);
      let release: (rows: Item[]) => void = () => {};
      const exportRows = vi.fn(
        () =>
          new Promise<Item[]>(resolve => {
            release = resolve;
          })
      );
      const { source, calls } = fakeSource({ exportRows });
      render(<DataTable id="orders" data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} csvExport defaultSortBy={[{ key: 'name', direction: 'desc' }]} />);
      await answer(calls[0], itemsFrom(1, 10), 99);

      fireEvent.click(screen.getByLabelText('Export CSV'));
      expect(exportRows).toHaveBeenCalledTimes(1);
      expect(exportRows).toHaveBeenCalledWith(expect.objectContaining({ sortBy: [{ key: 'name', direction: 'desc' }], quickFilter: '' }));
      // Awaited: nothing downloaded until the Promise settles.
      expect(createObjectURL).not.toHaveBeenCalled();
      await act(async () => {
        release(itemsFrom(1, 99));
      });
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(exported).toHaveBeenCalledWith({ id: 'orders', rowCount: 99 });
      unsub();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    });

    it('select-all without getAllKeys selects the loaded rows only, and says so', async () => {
      const onSelectionChange = vi.fn();
      const { source, calls } = fakeSource();
      render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} selectable onSelectionChange={onSelectionChange} />);
      await answer(calls[0], itemsFrom(1, 10), 500);

      fireEvent.click(screen.getByRole('checkbox', { name: 'Select all rows on this page' }));
      expect(onSelectionChange).toHaveBeenLastCalledWith(itemsFrom(1, 10).map(i => String(i.id)));
    });

    it('select-all with getAllKeys selects every matching key (awaited), labelled accordingly', async () => {
      const onSelectionChange = vi.fn();
      const allKeys = Array.from({ length: 500 }, (_, i) => String(i + 1));
      let release: (keys: string[]) => void = () => {};
      const getAllKeys = vi.fn(
        () =>
          new Promise<string[]>(resolve => {
            release = resolve;
          })
      );
      const { source, calls } = fakeSource({ getAllKeys });
      render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} selectable onSelectionChange={onSelectionChange} />);
      await answer(calls[0], itemsFrom(1, 10), 500);

      fireEvent.click(screen.getByRole('checkbox', { name: 'Select all matching rows' }));
      expect(getAllKeys).toHaveBeenCalledWith(expect.objectContaining({ sortBy: [], quickFilter: '' }));
      expect(onSelectionChange).not.toHaveBeenCalled();
      await act(async () => {
        release(allKeys);
      });
      expect(onSelectionChange).toHaveBeenLastCalledWith(allKeys);
    });
  });

  it('datatable:refresh with the table id re-requests the current page; another id does not', async () => {
    const { source, calls } = fakeSource();
    render(<DataTable id="orders" data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
    await answer(calls[0], itemsFrom(1, 10), 50);

    act(() => aiBus.emit('datatable:refresh', { id: 'someone-else' }));
    expect(calls).toHaveLength(1);

    act(() => aiBus.emit('datatable:refresh', { id: 'orders' }));
    expect(calls).toHaveLength(2);
    expect(calls[1].query).toMatchObject({ start: 0, count: 10 });
    await answer(calls[1], itemsFrom(1, 10), 51);
    expect(screen.getByText('Showing 1 to 10 of 51 entries')).toBeInTheDocument();
  });

  it('shows the emptyState when the source reports no rows, but not while still loading', async () => {
    const { source, calls } = fakeSource();
    render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} emptyState={<p>Nothing here</p>} />);
    expect(screen.queryByText('Nothing here')).not.toBeInTheDocument();
    await answer(calls[0], [], 0);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('a new source object refetches', async () => {
    const first = fakeSource();
    const { rerender } = render(<DataTable data={first.source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
    await answer(first.calls[0], itemsFrom(1, 10), 10);

    const second = fakeSource();
    rerender(<DataTable data={second.source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
    expect(second.calls).toHaveLength(1);
    await answer(second.calls[0], itemsFrom(101, 10), 10);
    expect(screen.getByText('Item 101')).toBeInTheDocument();
  });

  it('a custom source that answers with a plain object renders its rows after the first effect, once per query', async () => {
    const getRows = vi.fn((query: DataTableQuery) => ({ rows: itemsFrom(query.start + 1, 3), totalCount: 3 }));
    render(<DataTable data={{ getRows }} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
    await waitFor(() => expect(screen.getByText('Item 1')).toBeInTheDocument());
    expect(screen.getByText('Showing 1 to 3 of 3 entries')).toBeInTheDocument();
    expect(screen.getByRole('grid')).not.toHaveAttribute('aria-busy');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(getRows).toHaveBeenCalledTimes(1);
  });

  it('a branded createArrayDataSource passed as data renders on the FIRST render, synchronously', () => {
    const source = createArrayDataSource(itemsFrom(1, 25), { columns, rowKey });
    render(<DataTable data={source} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
    // No act()/waitFor: the rows are in the first committed frame.
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 to 10 of 25 entries')).toBeInTheDocument();
    expect(screen.getByRole('grid')).not.toHaveAttribute('aria-busy');
  });

  it('spreading a branded source to override a method makes it an ordinary (effect-called) source', async () => {
    const base = createArrayDataSource(itemsFrom(1, 5), { columns });
    const getRows = vi.fn((q: DataTableQuery) => base.getRows(q));
    render(<DataTable data={{ ...base, getRows }} columns={columns} rowKey={rowKey} defaultPageSize={10} />);
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Item 1')).toBeInTheDocument());
  });

  it('typing is debounced for a custom source even if it answers synchronously', async () => {
    vi.useFakeTimers();
    const getRows = vi.fn((query: DataTableQuery) => ({ rows: itemsFrom(1, query.quickFilter ? 1 : 2), totalCount: query.quickFilter ? 1 : 2 }));
    render(<DataTable data={{ getRows }} columns={columns} rowKey={rowKey} defaultPageSize={10} quickFilter />);
    await flush();
    expect(getRows).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'x' } });
    expect(getRows).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(250);
    });
    expect(getRows).toHaveBeenLastCalledWith(expect.objectContaining({ quickFilter: 'x' }));
    expect(screen.getByText('Showing 1 to 1 of 1 entries')).toBeInTheDocument();
  });

  it('the built-in array source filters immediately (no debounce)', () => {
    render(<DataTable data={createArrayDataSource(itemsFrom(1, 25), { columns })} columns={columns} rowKey={rowKey} defaultPageSize={10} quickFilter />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Item 7' } });
    expect(screen.getByText('Showing 1 to 1 of 1 entries')).toBeInTheDocument();
  });

  it('requires rowKey for a data source at the type level, and not for an array', () => {
    const { source } = fakeSource();
    // @ts-expect-error -- a data source without rowKey
    <DataTable data={source} columns={columns} />;
    // An array still defaults to the index.
    <DataTable data={[item(1)]} columns={columns} />;
    // And a source with rowKey is fine.
    <DataTable data={source} columns={columns} rowKey={rowKey} />;
  });
});
