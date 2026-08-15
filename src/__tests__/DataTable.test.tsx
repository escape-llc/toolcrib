import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable, Column } from '../components/DataTable/DataTable';
import { aiBus } from '../eventBus/eventBus';

interface TestItem {
  id: number;
  name: string;
}

const testData: TestItem[] = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
}));

const testColumns: Column<TestItem>[] = [
  { key: 'id', title: 'ID', sortable: true },
  { key: 'name', title: 'Name', sortable: true },
];

describe('DataTable Virtualized Component', () => {
  it('renders paginated data correctly', () => {
    render(<DataTable data={testData} columns={testColumns} pageSize={10} />);

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 to 10 of 50 entries')).toBeInTheDocument();
  });

  it('navigates through pages using glyph buttons', () => {
    render(<DataTable data={testData} columns={testColumns} pageSize={10} />);

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByText('Showing 11 to 20 of 50 entries')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(screen.getByText('Showing 1 to 10 of 50 entries')).toBeInTheDocument();
  });

  it('sorts columns on click', () => {
    render(<DataTable data={testData} columns={testColumns} pageSize={10} />);

    fireEvent.click(screen.getByText('Name'));
    expect(screen.getByText('Name')).toBeInTheDocument();
  });

  it('applies a minHeight floor in auto height mode (default), so a collapsed flex ancestor still shows rows', () => {
    // Regression test: containerHeight="auto" (the default) fills its
    // parent via `flex: 1 1 0px` + `height: 100%`, which only resolves to
    // something nonzero when the immediate ancestor is itself a flex
    // column with a definite height (e.g. a Splitter.Panel). Nested
    // directly in a plain content wrapper (e.g. a bare TabStrip.Panel),
    // that flex chain has nothing to grow into and previously collapsed
    // to 0 — rows rendered correctly in the DOM, just clipped inside an
    // invisible 0-height scroll container. See DataTable.tsx's
    // AUTO_HEIGHT_FALLBACK_PX comment for the full mechanism.
    const { container } = render(<DataTable data={testData} columns={testColumns} pageSize={10} />);
    const table = container.querySelector('table');
    const scrollBody = table?.parentElement as HTMLElement;
    expect(scrollBody.style.minHeight).not.toBe('0px');
    expect(scrollBody.style.minHeight).not.toBe('');
  });

  it('leaves minHeight unset (0) when a fixed containerHeight is given', () => {
    // The floor is specifically an auto-mode safety net — an explicit
    // pixel height already guarantees visibility on its own, and forcing
    // a floor here would fight a deliberately small containerHeight.
    const { container } = render(<DataTable data={testData} columns={testColumns} pageSize={10} containerHeight={500} />);
    const table = container.querySelector('table');
    const scrollBody = table?.parentElement as HTMLElement;
    expect(scrollBody.style.minHeight).toBe('0px');
  });

  it('regression: does not silently jump back to a stale page after data shrinks then grows again', () => {
    // Reproduces the bug: navigate to a later page, have the parent shrink
    // `data` (e.g. a search/filter above the table), which correctly
    // clamps the *displayed* page — then have the parent restore the
    // original data. Without syncing `currentPage` itself (not just the
    // derived display value) back when totalPages changes, the table used
    // to jump straight back to the stale page instead of staying on the
    // page the user was actually looking at.
    const { rerender } = render(<DataTable data={testData} columns={testColumns} pageSize={10} />);

    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByText('5 / 5')).toBeInTheDocument();

    const filtered = testData.slice(0, 5);
    rerender(<DataTable data={filtered} columns={testColumns} pageSize={10} />);
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect((screen.getByLabelText('Previous page') as HTMLButtonElement).disabled).toBe(true);

    rerender(<DataTable data={testData} columns={testColumns} pageSize={10} />);
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 to 10 of 50 entries')).toBeInTheDocument();
  });

  it('tints a flagged row with its subtheme background and dashed border', () => {
    render(
      <DataTable
        data={testData}
        columns={testColumns}
        pageSize={10}
        rowSubtheme={(record: TestItem) => (record.id === 1 ? 'error' : undefined)}
      />
    );

    const flaggedRow = screen.getByText('Item 1').closest('tr') as HTMLElement;
    expect(flaggedRow.style.background).toBe('var(--ai-subtheme-error-bg)');
    expect(flaggedRow.style.borderBottom).toBe('0.0625rem dashed var(--ai-subtheme-error-border)');

    const plainRow = screen.getByText('Item 2').closest('tr') as HTMLElement;
    expect(plainRow.style.background).not.toBe('var(--ai-subtheme-error-bg)');
  });

  it('suppresses the flagged-row border when overrides disable table borders', () => {
    render(
      <DataTable
        data={testData}
        columns={testColumns}
        pageSize={10}
        overrides={{ borderStyle: 'none' }}
        rowSubtheme={(record: TestItem) => (record.id === 1 ? 'error' : undefined)}
      />
    );

    const flaggedRow = screen.getByText('Item 1').closest('tr') as HTMLElement;
    // Still tinted...
    expect(flaggedRow.style.background).toBe('var(--ai-subtheme-error-bg)');
    // ...but the dashed border a 'none' borderStyle should suppress is gone.
    // (jsdom normalizes the `border-bottom: none` shorthand rather than
    // echoing the literal string back, so check the longhand style instead.)
    expect(getComputedStyle(flaggedRow).borderBottomStyle).toBe('none');
  });

  it('accepts a custom Partial<SubthemeColors> slice from rowSubtheme, applying only the fields it sets', () => {
    render(
      <DataTable
        data={testData}
        columns={testColumns}
        pageSize={10}
        rowSubtheme={(record: TestItem) => (record.id === 1 ? { background: 'rebeccapurple' } : undefined)}
      />
    );

    const flaggedRow = screen.getByText('Item 1').closest('tr') as HTMLElement;
    expect(flaggedRow.style.background).toBe('rebeccapurple');
    // border/color weren't set in the slice, so they fall back to the
    // row's normal unflagged appearance rather than to any preset.
    expect(flaggedRow.style.borderBottom).toBe('0.0625rem solid var(--ai-border, #f3f4f6)');

    const flaggedCell = screen.getByText('Item 1');
    expect(flaggedCell.style.color).toBe('var(--ai-text-primary, #111827)');
  });

  it('does not let a stale in-flight scroll frame stomp the reset when sorting mid-scroll', async () => {
    const { container } = render(
      <DataTable data={testData} columns={testColumns} pageSize={50} containerHeight={200} />
    );
    const table = container.querySelector('table');
    const scrollBody = table?.parentElement as HTMLElement;

    // Scroll far down — schedules a throttled rAF that hasn't fired yet...
    fireEvent.scroll(scrollBody, { target: { scrollTop: 800 } });
    // ...then immediately sort, before that frame gets a chance to fire.
    // Without cancelling the in-flight frame, it would later reapply the
    // stale 800 offset on top of the sort's scroll reset.
    fireEvent.click(screen.getByText('ID'));

    // Let the (should-be-cancelled) frame resolve.
    await new Promise(resolve => requestAnimationFrame(resolve));

    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('sorts NaN numeric values to the end instead of an unspecified position', () => {
    interface ScoredItem {
      id: number;
      name: string;
      score: number;
    }
    const nanData: ScoredItem[] = [
      { id: 1, name: 'Alpha', score: 50 },
      { id: 2, name: 'Beta', score: NaN },
      { id: 3, name: 'Gamma', score: 10 },
    ];
    const scoredColumns: Column<ScoredItem>[] = [
      { key: 'name', title: 'Name', sortable: true },
      { key: 'score', title: 'Score', sortable: true },
    ];

    render(<DataTable data={nanData} columns={scoredColumns} pageSize={10} />);
    fireEvent.click(screen.getByText('Score')); // ascending

    const dataRows = screen.getAllByRole('row').slice(1); // drop the header row
    const order = dataRows.map(row => (row.textContent?.includes('Gamma') ? 'Gamma' : row.textContent?.includes('Alpha') ? 'Alpha' : 'Beta'));
    expect(order).toEqual(['Gamma', 'Alpha', 'Beta']);
  });

  it('emits datatable:sorted with the resolved key/direction, cycling asc -> desc -> unsorted', () => {
    const sortedFn = vi.fn();
    const unsub = aiBus.on('datatable:sorted', sortedFn);

    render(<DataTable id="my-table" data={testData} columns={testColumns} pageSize={10} />);

    fireEvent.click(screen.getByText('Name'));
    expect(sortedFn).toHaveBeenLastCalledWith({ id: 'my-table', key: 'name', direction: 'asc' });

    fireEvent.click(screen.getByText('Name'));
    expect(sortedFn).toHaveBeenLastCalledWith({ id: 'my-table', key: 'name', direction: 'desc' });

    fireEvent.click(screen.getByText('Name'));
    expect(sortedFn).toHaveBeenLastCalledWith({ id: 'my-table', key: null, direction: 'desc' });

    unsub();
  });

  it('emits datatable:paginated from Prev/Next and the page-size select', () => {
    const paginatedFn = vi.fn();
    const unsub = aiBus.on('datatable:paginated', paginatedFn);

    render(<DataTable id="my-table" data={testData} columns={testColumns} pageSize={10} />);

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(paginatedFn).toHaveBeenLastCalledWith({ id: 'my-table', page: 2, pageSize: 10 });

    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(paginatedFn).toHaveBeenLastCalledWith({ id: 'my-table', page: 1, pageSize: 10 });

    fireEvent.change(screen.getByDisplayValue('10 per page'), { target: { value: '25' } });
    expect(paginatedFn).toHaveBeenLastCalledWith({ id: 'my-table', page: 1, pageSize: 25 });

    unsub();
  });

  it('emits datatable:row_clicked and calls onRowClick, showing a pointer cursor only when onRowClick is given', () => {
    const rowClickedFn = vi.fn();
    const onRowClick = vi.fn();
    const unsub = aiBus.on('datatable:row_clicked', rowClickedFn);

    const { rerender } = render(<DataTable id="my-table" data={testData} columns={testColumns} pageSize={10} />);
    const plainRow = screen.getByText('Item 1').closest('tr') as HTMLElement;
    expect(plainRow.style.cursor).toBe('');
    fireEvent.click(plainRow);
    expect(rowClickedFn).toHaveBeenLastCalledWith({ id: 'my-table', index: 0 });
    expect(onRowClick).not.toHaveBeenCalled();

    rerender(<DataTable id="my-table" data={testData} columns={testColumns} pageSize={10} onRowClick={onRowClick} />);
    const clickableRow = screen.getByText('Item 1').closest('tr') as HTMLElement;
    expect(clickableRow.style.cursor).toBe('pointer');
    fireEvent.click(clickableRow);
    expect(onRowClick).toHaveBeenCalledWith(testData[0], 0);
    expect(rowClickedFn).toHaveBeenLastCalledWith({ id: 'my-table', index: 0 });

    unsub();
  });
});
