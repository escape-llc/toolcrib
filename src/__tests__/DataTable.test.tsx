import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DataTable, type Column } from '../components/DataTable/DataTable';
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
    //
    // The floor lives on the outer wrapper only, not the scroll body
    // (bodyRef) — see the scroll body's own minHeight comment for why: the
    // scroll body used to carry this same floor, which meant it competed
    // for space independently of the pagination footer's own needs and
    // could push the footer outside the outer wrapper's visible bounds
    // whenever the floor was what actually sized the component (confirmed
    // via a real browser run). The scroll body is the one part that's
    // meant to shrink to absorb a tight allocation; the outer wrapper's
    // own floor is what guarantees the *whole* component (header, body,
    // footer together) still renders usefully when its ancestor gives it
    // nothing at all.
    const { container } = render(<DataTable data={testData} columns={testColumns} pageSize={10} />);
    const table = container.querySelector('table');
    const scrollBody = table?.parentElement as HTMLElement;
    const outerWrapper = scrollBody.parentElement as HTMLElement;
    expect(scrollBody.style.minHeight).toBe('0px');
    expect(outerWrapper.style.minHeight).not.toBe('0px');
    expect(outerWrapper.style.minHeight).not.toBe('');
  });

  it('never lets the pagination footer be pushed outside the outer wrapper, even when the auto-height floor is what sizes the component', () => {
    // Regression test for the bug the comment above describes concretely:
    // stub the outer wrapper down to exactly the AUTO_HEIGHT_FALLBACK_PX
    // floor (350px) — the scenario where the floor itself, not a generous
    // real ancestor, is what determines the component's rendered size —
    // and confirm the footer's own bottom edge never extends past the
    // wrapper's. jsdom doesn't run real flex layout, so this asserts the
    // CSS contract directly (scroll body has no competing floor of its
    // own; footer and bulk-bar both keep `flex: '0 0 auto'`, i.e. never
    // shrink) rather than measured pixel geometry — the same "assert the
    // CSS a real browser will resolve" approach the rest of this file's
    // height-related tests already use.
    const { container } = render(<DataTable data={testData} columns={testColumns} pageSize={10} />);
    const table = container.querySelector('table');
    const scrollBody = table?.parentElement as HTMLElement;
    const footer = scrollBody.nextElementSibling as HTMLElement;
    expect(scrollBody.style.flex).toBe('1 1 0px');
    expect(scrollBody.style.minHeight).toBe('0px');
    expect(footer.style.flex).toBe('0 0 auto');
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

  it('supports a controlled sortKey/sortDirection, calling onSortChange instead of managing its own state', () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <DataTable data={testData} columns={testColumns} pageSize={10} sortKey="id" sortDirection="asc" onSortChange={onSortChange} />
    );

    // The header already reflects the controlled sort (ascending).
    expect(screen.getByText('▲')).toBeInTheDocument();

    // Clicking cycles asc -> desc, but since this is controlled, the
    // component doesn't apply that itself — it only reports it upward.
    fireEvent.click(screen.getByText('ID'));
    expect(onSortChange).toHaveBeenLastCalledWith('id', 'desc');
    expect(screen.getByText('▲')).toBeInTheDocument();

    // Once the parent actually updates the controlled props, the
    // component reflects that new state.
    rerender(<DataTable data={testData} columns={testColumns} pageSize={10} sortKey="id" sortDirection="desc" onSortChange={onSortChange} />);
    expect(screen.getByText('▼')).toBeInTheDocument();
  });

  it('supports a controlled page, calling onPageChange instead of managing its own state', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(<DataTable data={testData} columns={testColumns} pageSize={10} page={2} onPageChange={onPageChange} />);

    expect(screen.getByText('Showing 11 to 20 of 50 entries')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    // Still on page 2 — the parent hasn't re-rendered with the new page yet.
    expect(screen.getByText('Showing 11 to 20 of 50 entries')).toBeInTheDocument();

    rerender(<DataTable data={testData} columns={testColumns} pageSize={10} page={3} onPageChange={onPageChange} />);
    expect(screen.getByText('Showing 21 to 30 of 50 entries')).toBeInTheDocument();
  });

  it('resolves a computed column via accessorFn and passes value/row/index as one object to render', () => {
    const renderSpy = vi.fn((ctx: { value: unknown; row: TestItem; index: number }) => <>{ctx.value as string}</>);
    const computedColumns: Column<TestItem>[] = [
      { key: 'id', title: 'ID', sortable: true },
      { key: 'upper', title: 'Upper', accessorFn: r => r.name.toUpperCase(), render: renderSpy },
    ];

    render(<DataTable data={testData} columns={computedColumns} pageSize={10} />);

    expect(screen.getByText('ITEM 1')).toBeInTheDocument();
    expect(renderSpy).toHaveBeenCalledWith({ value: 'ITEM 1', row: testData[0], index: 0 });
  });

  it('sorts by a computed accessorFn column instead of a direct property read', () => {
    interface ScoredItem {
      id: number;
      first: string;
      last: string;
    }
    const people: ScoredItem[] = [
      { id: 1, first: 'Charlie', last: 'Zulu' },
      { id: 2, first: 'Alice', last: 'Yankee' },
      { id: 3, first: 'Bob', last: 'Xray' },
    ];
    const nameColumns: Column<ScoredItem>[] = [
      { key: 'fullName', title: 'Full Name', sortable: true, accessorFn: r => `${r.first} ${r.last}` },
    ];

    render(<DataTable data={people} columns={nameColumns} pageSize={10} />);
    fireEvent.click(screen.getByText('Full Name'));

    const dataRows = screen.getAllByRole('row').slice(1);
    expect(dataRows.map(row => row.textContent)).toEqual(['Alice Yankee', 'Bob Xray', 'Charlie Zulu']);
  });

  it('virtualizes across the full dataset instead of the current page when pagination is disabled', async () => {
    const { container } = render(<DataTable data={testData} columns={testColumns} pagination={false} containerHeight={200} itemHeight={44} />);

    // No pagination footer at all in this mode.
    expect(screen.queryByLabelText('Next page')).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument();

    const table = container.querySelector('table');
    const scrollBody = table?.parentElement as HTMLElement;
    // The scroll handler throttles to one setScrollTop per animation frame
    // (see DataTable.tsx's own comment on why) — that frame's state update
    // needs to be inside act() itself, not just awaited afterward, or React
    // logs an "update not wrapped in act" warning even though the assertion
    // below is otherwise correct.
    fireEvent.scroll(scrollBody, { target: { scrollTop: 50 * 44 } });
    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(resolve));
    });

    expect(screen.getByText('Item 50')).toBeInTheDocument();
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

  describe('row selection', () => {
    it('renders no selection checkboxes when selectable is false (the default)', () => {
      render(<DataTable data={testData} columns={testColumns} pageSize={10} />);
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    });

    it('selects a row via its checkbox and calls onSelectionChange', () => {
      const onSelectionChange = vi.fn();
      render(
        <DataTable
          data={testData}
          columns={testColumns}
          pageSize={10}
          rowKey={r => r.id}
          selectable
          onSelectionChange={onSelectionChange}
        />
      );
      fireEvent.click(screen.getByLabelText('Select row 1'));
      expect(onSelectionChange).toHaveBeenCalledWith(['1']);
    });

    it('clicking a row checkbox does not also trigger onRowClick', () => {
      const onRowClick = vi.fn();
      render(
        <DataTable data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} selectable onRowClick={onRowClick} />
      );
      fireEvent.click(screen.getByLabelText('Select row 1'));
      expect(onRowClick).not.toHaveBeenCalled();
    });

    it('the header checkbox reflects unchecked/indeterminate/checked for the current page only', () => {
      render(<DataTable data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} selectable />);
      const headerCheckbox = screen.getByLabelText('Select all rows on this page');
      expect(headerCheckbox).toHaveAttribute('data-state', 'unchecked');

      fireEvent.click(screen.getByLabelText('Select row 1'));
      expect(headerCheckbox).toHaveAttribute('data-state', 'indeterminate');

      for (let i = 1; i <= 10; i++) {
        fireEvent.click(screen.getByLabelText(`Select row ${i}`));
      }
      // Row 1 was already selected -- clicking it again above toggled it off, so re-select it.
      fireEvent.click(screen.getByLabelText('Select row 1'));
      expect(headerCheckbox).toHaveAttribute('data-state', 'checked');
    });

    it('the header checkbox selects/deselects every row on the current page at once', () => {
      render(<DataTable data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} selectable />);
      fireEvent.click(screen.getByLabelText('Select all rows on this page'));
      for (let i = 1; i <= 10; i++) {
        expect(screen.getByLabelText(`Select row ${i}`)).toHaveAttribute('data-state', 'checked');
      }

      fireEvent.click(screen.getByLabelText('Select all rows on this page'));
      for (let i = 1; i <= 10; i++) {
        expect(screen.getByLabelText(`Select row ${i}`)).toHaveAttribute('data-state', 'unchecked');
      }
    });

    // The doc's own acceptance bar for this item: proves selection actually
    // persists across pages, not just that the feature was decided that way.
    it('persists selection across pages — selecting a row, changing page, then returning shows it still checked', () => {
      render(<DataTable data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} selectable />);

      fireEvent.click(screen.getByLabelText('Select row 1'));
      expect(screen.getByLabelText('Select row 1')).toHaveAttribute('data-state', 'checked');

      fireEvent.click(screen.getByLabelText('Next page'));
      // "Select row 1" is a page-relative label (matching rowSubtheme's own
      // documented index convention), so it's reused here for a *different*
      // underlying record (page 2's first row, id 11) -- confirm that one
      // shows unchecked, proving selection tracks real row identity via
      // rowKey, not display position.
      expect(screen.getByLabelText('Select row 1')).toHaveAttribute('data-state', 'unchecked');

      fireEvent.click(screen.getByLabelText('Previous page'));
      expect(screen.getByLabelText('Select row 1')).toHaveAttribute('data-state', 'checked');
    });

    it('supports a controlled selectedKeys, calling onSelectionChange instead of managing its own state', () => {
      const onSelectionChange = vi.fn();
      const { rerender } = render(
        <DataTable
          data={testData}
          columns={testColumns}
          pageSize={10}
          rowKey={r => r.id}
          selectable
          selectedKeys={['1']}
          onSelectionChange={onSelectionChange}
        />
      );
      expect(screen.getByLabelText('Select row 1')).toHaveAttribute('data-state', 'checked');

      fireEvent.click(screen.getByLabelText('Select row 2'));
      expect(onSelectionChange).toHaveBeenCalledWith(['1', '2']);
      // Still only row 1 checked -- the parent hasn't re-rendered with the new selection yet.
      expect(screen.getByLabelText('Select row 2')).toHaveAttribute('data-state', 'unchecked');

      rerender(
        <DataTable
          data={testData}
          columns={testColumns}
          pageSize={10}
          rowKey={r => r.id}
          selectable
          selectedKeys={['1', '2']}
          onSelectionChange={onSelectionChange}
        />
      );
      expect(screen.getByLabelText('Select row 2')).toHaveAttribute('data-state', 'checked');
    });

    it('emits datatable:selection_changed', () => {
      const changedFn = vi.fn();
      const unsub = aiBus.on('datatable:selection_changed', changedFn);
      render(<DataTable id="my-table" data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} selectable />);
      fireEvent.click(screen.getByLabelText('Select row 1'));
      expect(changedFn).toHaveBeenLastCalledWith({ id: 'my-table', selectedKeys: ['1'] });
      unsub();
    });

    it('shows the bulk action bar with a selection count only once at least one row is selected, rendering the consumer-supplied actions', () => {
      render(
        <DataTable
          data={testData}
          columns={testColumns}
          pageSize={10}
          rowKey={r => r.id}
          selectable
          renderBulkActions={keys => <button>{`Delete ${keys.length}`}</button>}
        />
      );
      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Select row 1'));
      expect(screen.getByText('1 selected')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete 1' })).toBeInTheDocument();
    });
  });

  describe('regression: sortable headers were mouse-only with no aria-sort, and sortable defaulted to true', () => {
    // Headers had no tabIndex/onKeyDown, so a sortable column could only be
    // triggered by a mouse click, and every header (sortable or not) had
    // aria-sort: null regardless of state. Separately, every check used
    // `col.sortable !== false`, so an omitted `sortable` key (undefined)
    // evaluated true and sorted a column that never opted in — contradicting
    // the JSDoc's own `@default false`.
    const nonSortableColumns: Column<TestItem>[] = [
      { key: 'id', title: 'ID', sortable: true },
      { key: 'actions', title: 'Actions' }, // sortable omitted entirely
    ];

    it('does not treat an omitted sortable key as sortable', () => {
      const sortedFn = vi.fn();
      const unsub = aiBus.on('datatable:sorted', sortedFn);
      render(<DataTable data={testData} columns={nonSortableColumns} pageSize={10} />);

      const actionsHeader = screen.getByText('Actions').closest('th')!;
      expect(actionsHeader).toHaveStyle({ cursor: 'default' });
      expect(actionsHeader).not.toHaveAttribute('tabindex');
      expect(actionsHeader).not.toHaveAttribute('aria-sort');

      fireEvent.click(actionsHeader);
      expect(sortedFn).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'actions' }));
      unsub();
    });

    it('makes a sortable header keyboard-focusable and Enter-activatable, updating aria-sort', () => {
      render(<DataTable data={testData} columns={testColumns} pageSize={10} />);
      const idHeader = screen.getByText('ID').closest('th')!;

      expect(idHeader).toHaveAttribute('tabindex', '0');
      expect(idHeader).toHaveAttribute('aria-sort', 'none');

      fireEvent.keyDown(idHeader, { key: 'Enter' });
      expect(idHeader).toHaveAttribute('aria-sort', 'ascending');

      fireEvent.keyDown(idHeader, { key: 'Enter' });
      expect(idHeader).toHaveAttribute('aria-sort', 'descending');
    });
  });
});
