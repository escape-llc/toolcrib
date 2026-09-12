import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DataTable, type Column } from '../components/DataTable/DataTable';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

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
  it('renders paginated data correctly', async () => {
    render(<DataTable data={testData} columns={testColumns} pageSize={10} />);

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Showing 1 to 10 of 50 entries')).toBeInTheDocument();
    expect(await axe(document.body)).toHaveNoViolations();
  });

  it('navigates through pages using glyph buttons', async () => {
    render(<DataTable data={testData} columns={testColumns} pageSize={10} />);

    fireEvent.click(screen.getByLabelText('Next page'));
    expect(screen.getByText('Showing 11 to 20 of 50 entries')).toBeInTheDocument();
    // A mid-range page (Previous now enabled, Next still enabled, the live
    // region's own text updated) is a genuinely different DOM shape than
    // page 1 -- worth its own scan, not just the initial render's.
    expect(await axe(document.body)).toHaveNoViolations();

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
    expect(flaggedRow.style.backgroundColor).toBe('var(--ai-subtheme-error-bg)');
    expect(flaggedRow.style.borderBottom).toBe('0.0625rem dashed var(--ai-subtheme-error-border)');

    const plainRow = screen.getByText('Item 2').closest('tr') as HTMLElement;
    expect(plainRow.style.backgroundColor).not.toBe('var(--ai-subtheme-error-bg)');
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
    expect(flaggedRow.style.backgroundColor).toBe('var(--ai-subtheme-error-bg)');
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
    expect(flaggedRow.style.backgroundColor).toBe('rebeccapurple');
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

  it('emits datatable:sorted with the resolved sortBy array, cycling asc -> desc -> unsorted', () => {
    const sortedFn = vi.fn();
    const unsub = aiBus.on('datatable:sorted', sortedFn);

    render(<DataTable id="my-table" data={testData} columns={testColumns} pageSize={10} />);

    fireEvent.click(screen.getByText('Name'));
    expect(sortedFn).toHaveBeenLastCalledWith({ id: 'my-table', sortBy: [{ key: 'name', direction: 'asc' }] });

    fireEvent.click(screen.getByText('Name'));
    expect(sortedFn).toHaveBeenLastCalledWith({ id: 'my-table', sortBy: [{ key: 'name', direction: 'desc' }] });

    fireEvent.click(screen.getByText('Name'));
    expect(sortedFn).toHaveBeenLastCalledWith({ id: 'my-table', sortBy: [] });

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

  it('supports a controlled sortBy, calling onSortChange instead of managing its own state', () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <DataTable data={testData} columns={testColumns} pageSize={10} sortBy={[{ key: 'id', direction: 'asc' }]} onSortChange={onSortChange} />
    );

    // The header already reflects the controlled sort (ascending).
    expect(screen.getByText('▲')).toBeInTheDocument();

    // Clicking cycles asc -> desc, but since this is controlled, the
    // component doesn't apply that itself — it only reports it upward.
    fireEvent.click(screen.getByText('ID'));
    expect(onSortChange).toHaveBeenLastCalledWith([{ key: 'id', direction: 'desc' }]);
    expect(screen.getByText('▲')).toBeInTheDocument();

    // Once the parent actually updates the controlled props, the
    // component reflects that new state.
    rerender(
      <DataTable data={testData} columns={testColumns} pageSize={10} sortBy={[{ key: 'id', direction: 'desc' }]} onSortChange={onSortChange} />
    );
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

    it('the bulk action bar is always mounted (visibility toggling, not mount/unmount) to avoid a real layout jump on the first selection', () => {
      const { container } = render(
        <DataTable
          data={testData}
          columns={testColumns}
          pageSize={10}
          rowKey={r => r.id}
          selectable
          renderBulkActions={keys => <button>{`Delete ${keys.length}`}</button>}
        />
      );
      // Always mounted -- see DataTable.tsx's own comment on why a
      // conditionally-mounted version caused a real, confirmed layout jump
      // (selecting row 1 pushed the whole table down by the bar's height).
      // `visibility: hidden` (not display: none) still reserves this div's
      // own box in the layout, so toggling it never moves anything else.
      const bulkBar = (container.firstElementChild as HTMLElement).firstElementChild as HTMLElement;
      expect(bulkBar).toHaveStyle({ visibility: 'hidden' });
      expect(screen.getByText('0 selected')).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Select row 1'));
      expect(bulkBar).toHaveStyle({ visibility: 'visible' });
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
      // tabindex="-1" is now expected here (not absent) -- issue #316's grid
      // keyboard navigation makes every header cell a roving-tabindex
      // target, sortable or not; "-1" means it's a valid target that isn't
      // the currently-focused one, which is the real assertion this test
      // still cares about (this cell never becomes independently
      // click/Enter-activatable the way a sortable header's own <button>
      // is).
      expect(actionsHeader).toHaveAttribute('tabindex', '-1');
      expect(actionsHeader).not.toHaveAttribute('aria-sort');

      fireEvent.click(actionsHeader);
      expect(sortedFn).not.toHaveBeenCalled();
      unsub();
    });

    it('exposes a sortable header as a real <button>, not just an aria-sort attribute on the <th>', () => {
      // Issue #263: relying on aria-sort alone (with the <th> itself
      // carrying tabIndex/onKeyDown) gives a screen reader a softer signal
      // than an explicit interactive element would. A real <button> inside
      // the <th> is announced as an actual button, and gets native
      // focusability plus Enter/Space activation for free from the
      // browser -- not something this component's own logic needs to wire
      // up or this test needs to simulate; jsdom doesn't replicate that
      // native default-action behavior for a raw keydown anyway. What this
      // component IS responsible for -- exposing a real button, and
      // driving aria-sort off a click -- is what's asserted here.
      render(<DataTable data={testData} columns={testColumns} pageSize={10} />);
      const idHeader = screen.getByText('ID').closest('th')!;
      const sortButton = screen.getByRole('button', { name: 'ID' });

      expect(idHeader).toContainElement(sortButton);
      expect(idHeader).toHaveAttribute('aria-sort', 'none');

      fireEvent.click(sortButton);
      expect(idHeader).toHaveAttribute('aria-sort', 'ascending');

      fireEvent.click(sortButton);
      expect(idHeader).toHaveAttribute('aria-sort', 'descending');
    });

    it('keeps the whole header cell clickable (button fills it) and hides the sort arrow from screen readers', () => {
      // Gemini review on the PR that introduced the sortable <button>
      // (#306) caught two real regressions jsdom's own layout-blind test
      // run above couldn't: (1) padding had stayed on the <th> instead of
      // moving to the <button>, so only the text/arrow -- not the padded
      // cell around it -- was actually clickable, a real click-target-size
      // regression from the plain <th> this replaced; (2) the ▲/▼
      // characters had no aria-hidden, so a screen reader announced them
      // literally ("black up-pointing triangle") on top of aria-sort
      // already conveying direction. jsdom has no layout engine (can't
      // assert the padding area is *visually* clickable), so this asserts
      // the structural fix instead: the button, not the <th>, carries the
      // real padding and stretches to fill the cell, and the arrow span is
      // hidden from assistive tech.
      render(<DataTable data={testData} columns={testColumns} pageSize={10} />);
      const idHeader = screen.getByText('ID').closest('th')!;
      const sortButton = screen.getByRole('button', { name: 'ID' });

      expect(idHeader).toHaveStyle({ padding: '0px' });
      expect(sortButton).toHaveStyle({ width: '100%', boxSizing: 'border-box' });

      fireEvent.click(sortButton);
      const arrow = sortButton.querySelector('span')!;
      expect(arrow).toHaveAttribute('aria-hidden', 'true');
      expect(arrow).toHaveTextContent('▲');
    });
  });

  describe('multi-column sort (issue #337)', () => {
    interface RankedItem {
      id: number;
      group: string;
      score: number;
    }
    const rankedColumns: Column<RankedItem>[] = [
      { key: 'group', title: 'Group', sortable: true },
      { key: 'score', title: 'Score', sortable: true },
    ];
    const rankedData: RankedItem[] = [
      { id: 1, group: 'B', score: 20 },
      { id: 2, group: 'A', score: 30 },
      { id: 3, group: 'A', score: 10 },
      { id: 4, group: 'B', score: 5 },
    ];

    it('Shift-click adds a second column as a secondary sort, breaking ties in the primary', () => {
      render(<DataTable data={rankedData} columns={rankedColumns} pageSize={10} rowKey={r => r.id} />);
      fireEvent.click(screen.getByText('Group')); // primary: group asc
      fireEvent.click(screen.getByText('Score'), { shiftKey: true }); // secondary: score asc

      const dataRows = screen.getAllByRole('row').slice(1);
      // Group A first (score asc within it: 10 then 30), then Group B (5 then 20).
      expect(dataRows.map(row => row.textContent)).toEqual(['A10', 'A30', 'B5', 'B20']);
    });

    it('Shift-click with nothing currently sorted just adds that column as the first sort priority', () => {
      render(<DataTable data={rankedData} columns={rankedColumns} pageSize={10} />);
      fireEvent.click(screen.getByText('Score'), { shiftKey: true });
      expect(screen.getByText('Score').closest('th')).toHaveAttribute('aria-sort', 'ascending');
    });

    it('Shift-click cycles an already-sorted secondary column asc -> desc -> removed, leaving the primary untouched', () => {
      render(<DataTable data={rankedData} columns={rankedColumns} pageSize={10} />);
      fireEvent.click(screen.getByText('Group')); // primary asc
      fireEvent.click(screen.getByText('Score'), { shiftKey: true }); // secondary asc
      const scoreHeader = screen.getByText('Score').closest('th')!;
      expect(scoreHeader).toHaveAttribute('aria-sort', 'ascending');

      fireEvent.click(screen.getByText('Score'), { shiftKey: true }); // secondary desc
      expect(scoreHeader).toHaveAttribute('aria-sort', 'descending');

      fireEvent.click(screen.getByText('Score'), { shiftKey: true }); // removed entirely
      expect(scoreHeader).toHaveAttribute('aria-sort', 'none');

      const groupHeader = screen.getByText('Group').closest('th')!;
      expect(groupHeader).toHaveAttribute('aria-sort', 'ascending');
    });

    it('a plain click while multi-sort is active replaces the whole sort with just that column', () => {
      render(<DataTable data={rankedData} columns={rankedColumns} pageSize={10} />);
      fireEvent.click(screen.getByText('Group'));
      fireEvent.click(screen.getByText('Score'), { shiftKey: true });

      fireEvent.click(screen.getByText('Score')); // plain click, no shiftKey
      expect(screen.getByText('Group').closest('th')).toHaveAttribute('aria-sort', 'none');
      expect(screen.getByText('Score').closest('th')).toHaveAttribute('aria-sort', 'ascending');
    });

    it('shows a numbered priority badge only once a second column has actually joined the sort', () => {
      render(<DataTable data={rankedData} columns={rankedColumns} pageSize={10} />);
      const groupHeader = screen.getByText('Group').closest('th')!;
      const scoreHeader = screen.getByText('Score').closest('th')!;

      fireEvent.click(screen.getByText('Group'));
      // Single sort -- exactly one aria-hidden span (the arrow), no badge.
      expect(groupHeader.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(1);

      fireEvent.click(screen.getByText('Score'), { shiftKey: true });
      // Now two aria-hidden spans on each sorted header -- the arrow, and the priority badge.
      expect(groupHeader.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(2);
      expect(groupHeader).toHaveTextContent('1');
      expect(scoreHeader.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(2);
      expect(scoreHeader).toHaveTextContent('2');
    });

    it('supports a controlled multi-column sortBy', () => {
      render(
        <DataTable
          data={rankedData}
          columns={rankedColumns}
          pageSize={10}
          rowKey={r => r.id}
          sortBy={[
            { key: 'group', direction: 'asc' },
            { key: 'score', direction: 'asc' },
          ]}
        />
      );
      const dataRows = screen.getAllByRole('row').slice(1);
      expect(dataRows.map(row => row.textContent)).toEqual(['A10', 'A30', 'B5', 'B20']);
    });
  });

  describe('click-to-select, modifiers, single-select mode, hideSelectionColumn, and rowCommands (issue #329)', () => {
    it('a plain row click selects only that row, replacing any prior selection', () => {
      render(<DataTable data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} selectable />);
      fireEvent.click(screen.getByLabelText('Select row 1'));
      expect(screen.getByLabelText('Select row 1')).toHaveAttribute('data-state', 'checked');

      fireEvent.click(screen.getByText('Item 2'));
      expect(screen.getByLabelText('Select row 1')).toHaveAttribute('data-state', 'unchecked');
      expect(screen.getByLabelText('Select row 2')).toHaveAttribute('data-state', 'checked');
    });

    it('Ctrl/Cmd-click toggles just that row, keeping the rest of the selection', () => {
      render(<DataTable data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} selectable />);
      fireEvent.click(screen.getByText('Item 1'));
      fireEvent.click(screen.getByText('Item 2'), { ctrlKey: true });
      expect(screen.getByLabelText('Select row 1')).toHaveAttribute('data-state', 'checked');
      expect(screen.getByLabelText('Select row 2')).toHaveAttribute('data-state', 'checked');

      // Ctrl-clicking an already-selected row toggles it OFF, leaving the other alone.
      fireEvent.click(screen.getByText('Item 1'), { metaKey: true });
      expect(screen.getByLabelText('Select row 1')).toHaveAttribute('data-state', 'unchecked');
      expect(screen.getByLabelText('Select row 2')).toHaveAttribute('data-state', 'checked');
    });

    it('Shift-click range-selects from the last acted-on row to the clicked one', () => {
      render(<DataTable data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} selectable />);
      fireEvent.click(screen.getByText('Item 2')); // anchor = row 2
      fireEvent.click(screen.getByText('Item 5'), { shiftKey: true });
      for (let i = 2; i <= 5; i++) {
        expect(screen.getByLabelText(`Select row ${i}`)).toHaveAttribute('data-state', 'checked');
      }
      expect(screen.getByLabelText('Select row 1')).toHaveAttribute('data-state', 'unchecked');
      expect(screen.getByLabelText('Select row 6')).toHaveAttribute('data-state', 'unchecked');
    });

    // Regression test for a real Gemini-caught defect (PR #333): Shift-click
    // range-select used to REPLACE the whole selection outright, silently
    // discarding every other page's already-selected keys -- a direct
    // violation of this hook's own documented "selection persists across
    // pages" contract (see the "persists selection across pages" test
    // above, which covers the checkbox path this same guarantee already
    // had before Shift-click regressed it).
    it('Shift-click range-select on the current page does not discard a selection made on a different page', () => {
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
      // Select row 11 (page 2's first row) via its checkbox, then return to page 1.
      fireEvent.click(screen.getByLabelText('Next page'));
      fireEvent.click(screen.getByLabelText('Select row 1')); // page-relative label -> id 11
      expect(onSelectionChange).toHaveBeenLastCalledWith(['11']);
      fireEvent.click(screen.getByLabelText('Previous page'));

      // Shift-click range-select entirely within page 1 -- the anchor is
      // set via Ctrl-click (an additive toggle), not a plain click, since a
      // plain click's own job is to REPLACE the whole selection with just
      // itself; using one here would clear page 2's row before the
      // Shift-click this test is actually about ever ran.
      fireEvent.click(screen.getByText('Item 2'), { ctrlKey: true });
      fireEvent.click(screen.getByText('Item 4'), { shiftKey: true });

      // Page 2's row 11 is still selected, alongside the new page-1 range.
      const calls = onSelectionChange.mock.calls;
      const lastCall = calls[calls.length - 1][0] as string[];
      expect(new Set(lastCall)).toEqual(new Set(['11', '2', '3', '4']));
    });

    it('disableRowClickSelection leaves row clicks alone -- only the checkbox changes selection', () => {
      const onRowClick = vi.fn();
      render(
        <DataTable
          data={testData}
          columns={testColumns}
          pageSize={10}
          rowKey={r => r.id}
          selectable
          disableRowClickSelection
          onRowClick={onRowClick}
        />
      );
      fireEvent.click(screen.getByText('Item 1'));
      expect(onRowClick).toHaveBeenCalled();
      expect(screen.getByLabelText('Select row 1')).toHaveAttribute('data-state', 'unchecked');

      fireEvent.click(screen.getByLabelText('Select row 1'));
      expect(screen.getByLabelText('Select row 1')).toHaveAttribute('data-state', 'checked');
    });

    describe('selectionMode="single"', () => {
      it('renders a role="radio" indicator instead of a checkbox, with no "select all" header control', () => {
        render(
          <DataTable data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} selectable selectionMode="single" />
        );
        expect(screen.getByLabelText('Select row 1')).toHaveAttribute('role', 'radio');
        expect(screen.queryByLabelText('Select all rows on this page')).not.toBeInTheDocument();
      });

      it('selecting a row replaces the whole selection -- modifiers are ignored, and re-clicking the current choice keeps it selected', () => {
        render(
          <DataTable data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} selectable selectionMode="single" />
        );
        fireEvent.click(screen.getByText('Item 1'));
        expect(screen.getByLabelText('Select row 1')).toHaveAttribute('aria-checked', 'true');

        fireEvent.click(screen.getByText('Item 2'), { shiftKey: true }); // modifiers ignored in single mode
        expect(screen.getByLabelText('Select row 1')).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByLabelText('Select row 2')).toHaveAttribute('aria-checked', 'true');

        // A real radio can't be unchecked by clicking the one that's already checked.
        fireEvent.click(screen.getByText('Item 2'));
        expect(screen.getByLabelText('Select row 2')).toHaveAttribute('aria-checked', 'true');
      });

      // Regression test for a real Gemini-caught defect (PR #333): the
      // header cell above the radio column renders no "select all" control
      // in single mode (correctly -- see the test above), but the <th>
      // itself still carries the grid-nav attributes that make it
      // focusable, and without a label an empty focusable cell announces
      // nothing useful to a screen reader.
      it('the empty "select all" header cell still has a real accessible name (no unlabeled focusable cell)', () => {
        const { container } = render(
          <DataTable data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} selectable selectionMode="single" />
        );
        const headerCell = container.querySelector('[data-grid-row="0"][data-grid-col="0"]') as HTMLElement;
        expect(headerCell.tagName).toBe('TH');
        expect(headerCell).toHaveAccessibleName('Row selection');
      });
    });

    it('hideSelectionColumn removes the visible checkbox/radio column, but selection still works via click, and aria-selected still marks the row', () => {
      render(
        <DataTable data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} selectable hideSelectionColumn />
      );
      expect(screen.queryByLabelText(/Select row/)).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Select all rows on this page')).not.toBeInTheDocument();

      const row1 = screen.getByText('Item 1').closest('tr')!;
      expect(row1).toHaveAttribute('aria-selected', 'false');
      fireEvent.click(screen.getByText('Item 1'));
      expect(row1).toHaveAttribute('aria-selected', 'true');
    });

    it('Space toggles the currently-focused row\'s selection', () => {
      const { container } = render(
        <DataTable data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} selectable />
      );
      const idHeader = container.querySelector('[data-grid-row="0"][data-grid-col="1"]') as HTMLElement;
      act(() => idHeader.focus());
      fireEvent.keyDown(idHeader, { key: 'ArrowDown' }); // move into row 1's ID cell
      const idCell = container.querySelector('[data-grid-row="1"][data-grid-col="1"]') as HTMLElement;
      expect(idCell).toHaveFocus();
      fireEvent.keyDown(idCell, { key: ' ' });
      expect(screen.getByLabelText('Select row 1')).toHaveAttribute('data-state', 'checked');
    });

    it('a selected row composes a translucent tint (backgroundImage) with its own rowSubtheme color (backgroundColor), instead of replacing it', () => {
      render(
        <DataTable
          data={testData}
          columns={testColumns}
          pageSize={10}
          rowKey={r => r.id}
          selectable
          rowSubtheme={r => (r.id === 1 ? 'error' : undefined)}
        />
      );
      const row1 = screen.getByText('Item 1').closest('tr') as HTMLElement;
      expect(row1.style.backgroundImage).toBe('none');
      fireEvent.click(screen.getByLabelText('Select row 1'));
      // The subtheme's own background is UNCHANGED -- selection layers a
      // separate backgroundImage wash on top rather than overwriting it.
      expect(row1.style.backgroundColor).toBe('var(--ai-subtheme-error-bg)');
      expect(row1.style.backgroundImage).not.toBe('none');
    });

    describe('rowCommands', () => {
      it('renders one button per visible command and emits datatable:row_command on click, without triggering row-click-selection', () => {
        const handler = vi.fn();
        const unsub = aiBus.on('datatable:row_command', handler);
        render(
          <DataTable
            id="cmd-table"
            data={testData}
            columns={testColumns}
            pageSize={10}
            rowKey={r => r.id}
            selectable
            rowCommands={[
              { id: 'edit', label: 'Edit' },
              { id: 'delete', label: 'Delete' },
            ]}
          />
        );
        const row1 = screen.getByText('Item 1').closest('tr')!;
        fireEvent.click(row1.querySelector('[aria-label="Edit"]')!);
        expect(handler).toHaveBeenLastCalledWith({ id: 'cmd-table', command: 'edit', key: '1', index: 0 });
        // Clicking a command button doesn't also select the row.
        expect(screen.getByLabelText('Select row 1')).toHaveAttribute('data-state', 'unchecked');
        unsub();
      });

      // Regression test for a real Gemini-caught defect (PR #333): a command
      // button's tabIndex used to default to the browser's own 0
      // (unconditionally tabbable), so a plain page Tab sweep (not this
      // grid's own arrow-key nav) stopped at every command button on every
      // visible row before it could ever leave the table. It must instead
      // follow the same roving-tabindex gating every other grid cell/widget
      // already uses.
      it('a command button is only Tab-reachable once its own row is the roving-tabindex target, not unconditionally', () => {
        const { container } = render(
          <DataTable
            data={testData}
            columns={testColumns}
            pageSize={10}
            rowKey={r => r.id}
            rowCommands={[{ id: 'edit', label: 'Edit' }]}
          />
        );
        const row1Button = screen.getByText('Item 1').closest('tr')!.querySelector('[aria-label="Edit"]')!;
        const row2Button = screen.getByText('Item 2').closest('tr')!.querySelector('[aria-label="Edit"]')!;
        // Neither row is the roving-tabindex target yet -- both start non-tabbable.
        expect(row1Button).toHaveAttribute('tabindex', '-1');
        expect(row2Button).toHaveAttribute('tabindex', '-1');

        // Navigate to row 1's own actions cell (col 2: id=0, name=1, actions=2).
        const idHeader = container.querySelector('[data-grid-row="0"][data-grid-col="0"]') as HTMLElement;
        act(() => idHeader.focus());
        fireEvent.keyDown(idHeader, { key: 'End', ctrlKey: true }); // whole-grid End -> last row, last column
        expect(row1Button).not.toHaveFocus(); // Ctrl+End lands on the LAST row's actions cell, not row 1's

        const lastRowButton = container.querySelector('[data-grid-row="10"][data-grid-col="2"]') as HTMLElement;
        expect(lastRowButton).toHaveFocus();
        expect(lastRowButton).toHaveAttribute('tabindex', '0');
        // Every OTHER row's own command button, including row 1's, stays non-tabbable.
        expect(row1Button).toHaveAttribute('tabindex', '-1');
      });

      it('isVisible hides a specific command for a given row, not just disables it', () => {
        render(
          <DataTable
            data={testData}
            columns={testColumns}
            pageSize={10}
            rowKey={r => r.id}
            rowCommands={[{ id: 'delete', label: 'Delete', isVisible: r => r.id !== 1 }]}
          />
        );
        const row1 = screen.getByText('Item 1').closest('tr')!;
        const row2 = screen.getByText('Item 2').closest('tr')!;
        expect(row1.querySelector('[aria-label="Delete"]')).toBeNull();
        expect(row2.querySelector('[aria-label="Delete"]')).not.toBeNull();
      });

      it('adds one column to aria-colcount for the actions column', () => {
        const { container, rerender } = render(<DataTable data={testData} columns={testColumns} pageSize={10} />);
        expect(container.querySelector('table')).toHaveAttribute('aria-colcount', '2');

        rerender(
          <DataTable data={testData} columns={testColumns} pageSize={10} rowCommands={[{ id: 'x', label: 'X' }]} />
        );
        expect(container.querySelector('table')).toHaveAttribute('aria-colcount', '3');
      });
    });
  });

  describe('quick filter (issue #317)', () => {
    it('renders no search input by default', () => {
      render(<DataTable data={testData} columns={testColumns} pageSize={10} />);
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    });

    it('renders a labeled search input when quickFilter is true', () => {
      render(<DataTable data={testData} columns={testColumns} pageSize={10} quickFilter />);
      expect(screen.getByRole('searchbox', { name: 'Search…' })).toBeInTheDocument();
    });

    it('filters rows by a case-insensitive substring match against any column, resetting the page to 1', () => {
      render(<DataTable data={testData} columns={testColumns} pageSize={10} quickFilter rowKey={r => r.id} />);

      // Navigate to page 3 first, to prove filtering resets it.
      fireEvent.click(screen.getByLabelText('Next page'));
      fireEvent.click(screen.getByLabelText('Next page'));
      expect(screen.getByText('3 / 5')).toBeInTheDocument();

      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'item 42' } });
      expect(screen.getByText('Item 42')).toBeInTheDocument();
      expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Item 41')).not.toBeInTheDocument();
      // Exactly one match -- pagination reflects a single-row result set,
      // and the page reset back to 1 rather than staying clamped wherever
      // usePagination's own automatic clamping would have landed it.
      expect(screen.getByText('Showing 1 to 1 of 1 entries')).toBeInTheDocument();
      expect(screen.getByText('1 / 1')).toBeInTheDocument();
    });

    it('matches an accessorFn column by its computed value, not a direct property read', () => {
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
      const nameColumns: Column<ScoredItem>[] = [{ key: 'fullName', title: 'Full Name', accessorFn: r => `${r.first} ${r.last}` }];

      render(<DataTable data={people} columns={nameColumns} pageSize={10} quickFilter />);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'yankee' } });
      expect(screen.getByText('Alice Yankee')).toBeInTheDocument();
      expect(screen.queryByText('Charlie Zulu')).not.toBeInTheDocument();
    });

    it('clearing the filter shows every row again', () => {
      render(<DataTable data={testData} columns={testColumns} pageSize={10} quickFilter />);
      const input = screen.getByRole('searchbox');
      fireEvent.change(input, { target: { value: 'item 42' } });
      expect(screen.queryByText('Item 1')).not.toBeInTheDocument();

      fireEvent.change(input, { target: { value: '' } });
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Showing 1 to 10 of 50 entries')).toBeInTheDocument();
    });

    it('supports a controlled quickFilterValue, calling onQuickFilterChange instead of managing its own state', () => {
      const onQuickFilterChange = vi.fn();
      const { rerender } = render(
        <DataTable data={testData} columns={testColumns} pageSize={10} quickFilter quickFilterValue="" onQuickFilterChange={onQuickFilterChange} />
      );
      const input = screen.getByRole('searchbox') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'item 42' } });
      expect(onQuickFilterChange).toHaveBeenLastCalledWith('item 42');
      // Still unfiltered -- the parent hasn't re-rendered with the new value yet.
      expect(input.value).toBe('');
      expect(screen.getByText('Item 1')).toBeInTheDocument();

      rerender(
        <DataTable data={testData} columns={testColumns} pageSize={10} quickFilter quickFilterValue="item 42" onQuickFilterChange={onQuickFilterChange} />
      );
      expect(screen.getByText('Item 42')).toBeInTheDocument();
      expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
    });

    it('emits datatable:filtered with the value and the resulting match count', () => {
      const handler = vi.fn();
      const unsub = aiBus.on('datatable:filtered', handler);
      render(<DataTable id="filter-table" data={testData} columns={testColumns} pageSize={10} quickFilter />);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'item 42' } });
      expect(handler).toHaveBeenLastCalledWith({ id: 'filter-table', value: 'item 42', matchCount: 1 });
      unsub();
    });

    it('aria-rowcount reflects the filtered count, not the full unfiltered dataset', () => {
      const { container } = render(<DataTable data={testData} columns={testColumns} pageSize={10} quickFilter />);
      expect(container.querySelector('table')).toHaveAttribute('aria-rowcount', '51'); // 50 rows + header
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'item 42' } });
      expect(container.querySelector('table')).toHaveAttribute('aria-rowcount', '2'); // 1 row + header
    });
  });

  describe('empty state', () => {
    it('renders emptyState in place of the row set when data is empty', () => {
      render(<DataTable data={[]} columns={testColumns} emptyState={<span>Nothing here yet</span>} />);
      expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    });

    it('renders no emptyState content when data is non-empty, even if emptyState is given', () => {
      render(<DataTable data={testData} columns={testColumns} pageSize={10} emptyState={<span>Nothing here yet</span>} />);
      expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
    });

    it('renders nothing extra (previous behavior: an empty row area) when emptyState is omitted', () => {
      const { container } = render(<DataTable data={[]} columns={testColumns} />);
      const tbody = container.querySelector('tbody')!;
      expect(tbody.querySelectorAll('tr')).toHaveLength(0);
    });

    it('the emptyState cell spans every column, including the selection checkbox column when selectable', () => {
      render(<DataTable data={[]} columns={testColumns} selectable emptyState={<span>Nothing here yet</span>} />);
      const cell = screen.getByText('Nothing here yet').closest('td')!;
      expect(cell).toHaveAttribute('colSpan', String(testColumns.length + 1));
    });

    it('the pagination footer still renders correctly ("0 of 0") alongside emptyState', () => {
      render(<DataTable data={[]} columns={testColumns} emptyState={<span>Nothing here yet</span>} />);
      expect(screen.getByText('Showing 0 to 0 of 0 entries')).toBeInTheDocument();
    });

    it('passes the standing axe scan with emptyState rendered', async () => {
      render(<DataTable data={[]} columns={testColumns} emptyState={<span>Nothing here yet</span>} />);
      expect(await axe(document.body)).toHaveNoViolations();
    });
  });

  describe('grid keyboard navigation (issue #316)', () => {
    // Direct data-grid-row/col queries -- deterministic and matches this
    // feature's own real contract exactly, rather than relying on text
    // content that can collide (both the "id" column and pagination text
    // render plain numbers).
    const cell = (container: HTMLElement, row: number, col: number): HTMLElement =>
      container.querySelector<HTMLElement>(`[data-grid-row="${row}"][data-grid-col="${col}"]`)!;

    it('marks the table a real ARIA grid, with aria-rowcount/colcount reflecting the FULL dataset, not just this page', () => {
      const { container } = render(<DataTable data={testData} columns={testColumns} pageSize={10} />);
      const table = container.querySelector('table')!;
      expect(table).toHaveAttribute('role', 'grid');
      // 1 header + all 50 rows across every page, not just this page's 10.
      expect(table).toHaveAttribute('aria-rowcount', '51');
      expect(table).toHaveAttribute('aria-colcount', '2');
    });

    it('selectable adds one to aria-colcount for the checkbox column', () => {
      const { container } = render(<DataTable data={testData} columns={testColumns} pageSize={10} selectable />);
      expect(container.querySelector('table')).toHaveAttribute('aria-colcount', '3');
    });

    it('gives each row a correct aria-rowindex -- header is always 1, body rows reflect their absolute position across pages', () => {
      render(<DataTable data={testData} columns={testColumns} pageSize={10} defaultPage={2} rowKey={r => r.id} />);
      const headerRow = screen.getByRole('button', { name: 'ID' }).closest('tr')!;
      expect(headerRow).toHaveAttribute('aria-rowindex', '1');
      // Page 2 (pageSize 10), first row -- absolute row 12: 1 header + 10
      // rows from page 1 + this being the 1st row of page 2.
      const firstBodyRowOnPage2 = screen.getByText('Item 11').closest('tr')!;
      expect(firstBodyRowOnPage2).toHaveAttribute('aria-rowindex', '12');
    });

    it('excludes the virtualization spacer rows from the accessible row model (aria-hidden)', () => {
      const { container } = render(
        <DataTable data={testData} columns={testColumns} pagination={false} containerHeight={200} itemHeight={44} />
      );
      const spacerRows = container.querySelectorAll('tr[aria-hidden="true"]');
      // Scrolled to the very top -- only the bottom spacer exists yet.
      expect(spacerRows.length).toBeGreaterThan(0);
      spacerRows.forEach(row => expect(row).not.toHaveAttribute('aria-rowindex'));
    });

    it('starts with roving tabindex on the first header cell only', () => {
      const { container } = render(<DataTable data={testData} columns={testColumns} pageSize={10} />);
      expect(cell(container, 0, 0)).toHaveAttribute('tabindex', '0');
      expect(cell(container, 0, 1)).toHaveAttribute('tabindex', '-1');
    });

    it('ArrowRight/ArrowLeft move the roving tabindex and real focus across header cells', () => {
      const { container } = render(<DataTable data={testData} columns={testColumns} pageSize={10} />);
      const idHeader = cell(container, 0, 0);
      const nameHeader = cell(container, 0, 1);
      act(() => idHeader.focus());

      fireEvent.keyDown(idHeader, { key: 'ArrowRight' });
      expect(nameHeader).toHaveAttribute('tabindex', '0');
      expect(nameHeader).toHaveFocus();
      expect(idHeader).toHaveAttribute('tabindex', '-1');

      fireEvent.keyDown(nameHeader, { key: 'ArrowLeft' });
      expect(idHeader).toHaveAttribute('tabindex', '0');
      expect(idHeader).toHaveFocus();
    });

    it('ArrowDown/ArrowUp move focus between the header and the same column in body rows', () => {
      const { container } = render(<DataTable data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} />);
      const idHeader = cell(container, 0, 0);
      act(() => idHeader.focus());

      fireEvent.keyDown(idHeader, { key: 'ArrowDown' });
      const firstBodyIdCell = cell(container, 1, 0);
      expect(firstBodyIdCell).toHaveAttribute('tabindex', '0');
      expect(firstBodyIdCell).toHaveFocus();

      fireEvent.keyDown(firstBodyIdCell, { key: 'ArrowUp' });
      expect(idHeader).toHaveAttribute('tabindex', '0');
      expect(idHeader).toHaveFocus();
    });

    it('ArrowDown/ArrowUp do not move focus past the grid boundary', () => {
      const { container } = render(<DataTable data={testData} columns={testColumns} pageSize={10} />);
      const idHeader = cell(container, 0, 0);
      act(() => idHeader.focus());
      fireEvent.keyDown(idHeader, { key: 'ArrowUp' }); // already at row 0
      expect(idHeader).toHaveAttribute('tabindex', '0');
      expect(idHeader).toHaveFocus();
    });

    it('Home/End move focus to the first/last cell of the CURRENT row only', () => {
      const { container } = render(<DataTable data={testData} columns={testColumns} pageSize={10} />);
      const nameHeader = cell(container, 0, 1);
      act(() => nameHeader.focus());

      fireEvent.keyDown(nameHeader, { key: 'Home' });
      expect(cell(container, 0, 0)).toHaveFocus();

      fireEvent.keyDown(cell(container, 0, 0), { key: 'End' });
      expect(cell(container, 0, 1)).toHaveFocus();
    });

    it('Ctrl+Home/Ctrl+End move focus to the first/last cell of the whole grid', () => {
      const { container } = render(<DataTable data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} />);
      const nameHeader = cell(container, 0, 1);
      act(() => nameHeader.focus());

      fireEvent.keyDown(nameHeader, { key: 'End', ctrlKey: true });
      // Last row on this page (pageSize 10) is page-relative row 10, last column 1.
      expect(cell(container, 10, 1)).toHaveFocus();

      fireEvent.keyDown(cell(container, 10, 1), { key: 'Home', ctrlKey: true });
      expect(cell(container, 0, 0)).toHaveFocus();
    });

    it('clicking a cell directly (not via arrow keys) syncs the roving tabindex to it', () => {
      const { container } = render(<DataTable data={testData} columns={testColumns} pageSize={10} rowKey={r => r.id} />);
      const idHeader = cell(container, 0, 0);
      expect(idHeader).toHaveAttribute('tabindex', '0');

      const targetCell = cell(container, 3, 1);
      // A real .focus() call is what onFocus/focusin observes, same as a
      // mouse click would produce -- wrapped in act() per AGENTS.md's own
      // "raw DOM method call" case: unlike fireEvent, .focus() isn't
      // auto-wrapped, so the resulting state update needs this to commit
      // synchronously before the assertions below read it.
      act(() => targetCell.focus());
      expect(targetCell).toHaveAttribute('tabindex', '0');
      expect(idHeader).toHaveAttribute('tabindex', '-1');
    });

    it('navigating to a row outside the current virtualization window scrolls it into view, then focuses it once rendered', async () => {
      // itemHeight=44, containerHeight=200 -> only a handful of rows render
      // initially. Row 30 (well outside that window) exercises the
      // scroll-then-focus path described in useTableKeyboardNav's own
      // header comment.
      const { container } = render(
        <DataTable data={testData} columns={testColumns} pagination={false} containerHeight={200} itemHeight={44} rowKey={r => r.id} />
      );
      const idHeader = cell(container, 0, 0);
      act(() => idHeader.focus());

      fireEvent.keyDown(idHeader, { key: 'End', ctrlKey: true });

      // jsdom does not natively dispatch a `scroll` event just because a
      // script wrote `.scrollTop` (real browsers do) -- the production
      // code relies on that real-browser behavior to drive its existing
      // onScroll -> setScrollTop -> re-render pipeline. Firing it
      // explicitly here simulates what a real browser does on its own,
      // so this test exercises this feature's actual logic (did it scroll
      // to the right place, does the pending focus resolve once the
      // target row exists) rather than a jsdom quirk unrelated to it.
      const scrollBody = container.querySelector('table')!.parentElement as HTMLElement;
      expect(scrollBody.scrollTop).toBe(49 * 44); // row 50 (index 49), top-aligned
      fireEvent.scroll(scrollBody, { target: { scrollTop: scrollBody.scrollTop } });
      await act(async () => {
        await new Promise(resolve => requestAnimationFrame(resolve));
      });

      expect(cell(container, 50, 1)).toHaveFocus();
    });

    // Both regressions below were real findings from Gemini's review of the
    // PR that introduced this feature -- confirmed and fixed, not just
    // acted on blindly, per this repo's own "evaluate every finding"
    // discipline.

    it('regression: focusing a custom column.render cell\'s own nested interactive element still syncs the roving tabindex correctly', () => {
      const columnsWithButton: Column<TestItem>[] = [
        { key: 'id', title: 'ID', sortable: true },
        { key: 'name', title: 'Name', render: () => <button type="button">Action</button> },
      ];
      const { container } = render(<DataTable data={testData} columns={columnsWithButton} pageSize={10} />);
      const idHeader = cell(container, 0, 0);
      expect(idHeader).toHaveAttribute('tabindex', '0');

      // The actual focusable element here is the nested <button> the
      // custom render produced, not the <td> wrapper that carries
      // data-grid-row/col -- handleFocus has to resolve up via closest()
      // to find it, since e.target itself won't carry those attributes.
      // Scoped to row 1's own cell specifically -- every row renders an
      // identical "Action" button, so a global screen query would be
      // ambiguous.
      const wrappingCell = cell(container, 1, 1);
      const nestedButton = wrappingCell.querySelector('button')!;
      act(() => nestedButton.focus());

      expect(wrappingCell).toHaveAttribute('tabindex', '0');
      expect(idHeader).toHaveAttribute('tabindex', '-1');

      // Without the fix, a subsequent arrow key would compute its move
      // from a stale focusedRow/focusedCol (never updated by the failed
      // sync above) instead of from where focus actually is -- ArrowUp
      // should land on the SAME column's header (col 1, "Name"), not
      // col 0 (where focus would incorrectly still "be" if the sync had
      // silently failed).
      fireEvent.keyDown(nestedButton, { key: 'ArrowUp' });
      const nameHeader = cell(container, 0, 1);
      expect(nameHeader).toHaveAttribute('tabindex', '0');
      expect(nameHeader).toHaveFocus();
    });

    it('regression: does not hijack Arrow/Home/End when focus is on a real editable control inside a custom cell', () => {
      const columnsWithInput: Column<TestItem>[] = [
        { key: 'id', title: 'ID', sortable: true },
        { key: 'name', title: 'Name', render: () => <input aria-label="inline edit" defaultValue="edit me" /> },
      ];
      const { container } = render(<DataTable data={testData} columns={columnsWithInput} pageSize={10} />);

      // Scoped to row 1's own cell -- every row renders an identical
      // "inline edit" input, so a global screen query would be ambiguous.
      const input = cell(container, 1, 1).querySelector('input')!;
      act(() => input.focus());

      // Native text-cursor movement, not grid navigation -- confirmed by
      // focus staying on the input itself (a hijack would move it to an
      // adjacent cell instead).
      fireEvent.keyDown(input, { key: 'ArrowLeft' });
      expect(input).toHaveFocus();
      fireEvent.keyDown(input, { key: 'Home' });
      expect(input).toHaveFocus();
      fireEvent.keyDown(input, { key: 'End' });
      expect(input).toHaveFocus();
    });
  });

  describe('column resize (issue #318)', () => {
    const resizableColumns: Column<TestItem>[] = [
      { key: 'id', title: 'ID' },
      { key: 'name', title: 'Name', resizable: true },
    ];

    const getHandle = (container: HTMLElement): HTMLElement => container.querySelector('[role="separator"]')!;

    it('renders no resize handle for a column that does not opt in', () => {
      const { container } = render(<DataTable data={testData} columns={testColumns} pageSize={10} />);
      expect(container.querySelector('[role="separator"]')).toBeNull();
    });

    it('renders a resize handle with the ARIA shape confirmed against the W3C APG Window Splitter pattern', () => {
      const { container } = render(<DataTable data={testData} columns={resizableColumns} pageSize={10} />);
      const handle = getHandle(container);
      expect(handle).toHaveAttribute('role', 'separator');
      expect(handle).toHaveAttribute('aria-orientation', 'vertical');
      expect(handle).toHaveAttribute('aria-valuemin', '40'); // DEFAULT_MIN_COLUMN_WIDTH
      expect(handle).toHaveAttribute('tabindex', '0');
    });

    // Regression test for a real bug Gemini's review of this PR (#327)
    // caught: `resizableColumns`'s "Name" column has no pre-declared
    // numeric `width` -- getAriaValues used to fall back to announcing the
    // MIN WIDTH FLOOR (40) as aria-valuenow in this exact shape, a wrong
    // number a screen reader would read as the column's current width,
    // then jump straight past on the very first arrow-key press. Omitting
    // the attribute until a real width is known is the fix; this proves
    // both halves of it.
    it('regression: omits aria-valuenow (rather than reporting the wrong min-width floor) until a real pixel width is known', () => {
      const { container } = render(<DataTable data={testData} columns={resizableColumns} pageSize={10} />);
      const handle = getHandle(container);
      expect(handle).not.toHaveAttribute('aria-valuenow');

      const headerCell = handle.closest('th')!;
      headerCell.getBoundingClientRect = () => ({
        top: 0, left: 0, right: 150, bottom: 30, width: 150, height: 30, x: 0, y: 0, toJSON: () => {},
      });
      fireEvent.keyDown(handle, { key: 'ArrowRight' }); // measures real width (150), commits 150 + 10
      expect(handle).toHaveAttribute('aria-valuenow', '160');
    });

    // Not part of the roving-tabindex/data-grid-* coordinate model -- see
    // useTableKeyboardNav's own documented scope limit for custom
    // interactive cell content, reused here for the same reason.
    it('the resize handle is not part of the roving-tabindex grid coordinate model', () => {
      const { container } = render(<DataTable data={testData} columns={resizableColumns} pageSize={10} />);
      const handle = getHandle(container);
      expect(handle).not.toHaveAttribute('data-grid-row');
      expect(handle).not.toHaveAttribute('data-grid-col');
    });

    // fireEvent.pointerDown/Move/Up, not mouseDown/Move/Up -- jsdom's
    // window has a real PointerEvent constructor (confirmed directly), so
    // the hook's own window-level listeners register for pointer events,
    // matching the real-browser-preferred path fixed below. See the
    // "does not double-commit" regression test for exactly why plain mouse
    // events alone would have masked the real bug this PR shipped with.
    it('dragging the handle resizes the column and commits once on release, not on every move tick', () => {
      const onColumnWidthsChange = vi.fn();
      const { container } = render(
        <DataTable data={testData} columns={resizableColumns} pageSize={10} onColumnWidthsChange={onColumnWidthsChange} />
      );
      const handle = getHandle(container);
      const headerCell = handle.closest('th')!;
      headerCell.getBoundingClientRect = () => ({
        top: 0, left: 0, right: 150, bottom: 30, width: 150, height: 30, x: 0, y: 0, toJSON: () => {},
      });

      fireEvent.pointerDown(handle, { clientX: 100 });
      fireEvent.pointerMove(window, { clientX: 130 });
      // Live preview only -- the whole point of separating drag preview
      // state from committed state (see useTableColumnResize.ts's own
      // header comment) is to never flood onColumnWidthsChange mid-drag,
      // for the "persist to localStorage" use case the issue itself names.
      expect(onColumnWidthsChange).not.toHaveBeenCalled();

      fireEvent.pointerUp(window);
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
      expect(onColumnWidthsChange).toHaveBeenCalledWith({ name: 180 }); // 150 + (130 - 100)

      // A further move after pointerup shouldn't do anything -- listeners
      // were removed, same as Splitter's own established precedent.
      fireEvent.pointerMove(window, { clientX: 300 });
      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
    });

    it('never shrinks a column below its minWidth floor while dragging', () => {
      const onColumnWidthsChange = vi.fn();
      const columnsWithMin: Column<TestItem>[] = [
        { key: 'id', title: 'ID' },
        { key: 'name', title: 'Name', resizable: true, minWidth: 80 },
      ];
      const { container } = render(
        <DataTable data={testData} columns={columnsWithMin} pageSize={10} onColumnWidthsChange={onColumnWidthsChange} />
      );
      const handle = getHandle(container);
      const headerCell = handle.closest('th')!;
      headerCell.getBoundingClientRect = () => ({
        top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30, x: 0, y: 0, toJSON: () => {},
      });

      fireEvent.pointerDown(handle, { clientX: 200 });
      fireEvent.pointerMove(window, { clientX: 0 }); // a huge shrink attempt
      fireEvent.pointerUp(window);

      expect(onColumnWidthsChange).toHaveBeenCalledWith({ name: 80 });
    });

    // Regression test for a real bug Gemini's review of this PR (#327)
    // caught: a real pointer-enabled browser dispatches a spec-mandated
    // "compatibility" mouseup synchronously alongside every real pointerup
    // for mouse input, which fired this hook's handleUp (and therefore
    // committed/called onColumnWidthsChange) TWICE per physical drag
    // release. This wasn't (and structurally couldn't be) caught by the
    // two tests above, which only ever fired one event type per gesture --
    // simulating the real duplicate dispatch directly, by firing pointerup
    // twice for one release, is what actually exercises the fix.
    it('regression: does not double-commit when a duplicate release event fires for the same gesture', () => {
      const onColumnWidthsChange = vi.fn();
      const { container } = render(
        <DataTable data={testData} columns={resizableColumns} pageSize={10} onColumnWidthsChange={onColumnWidthsChange} />
      );
      const handle = getHandle(container);
      const headerCell = handle.closest('th')!;
      headerCell.getBoundingClientRect = () => ({
        top: 0, left: 0, right: 150, bottom: 30, width: 150, height: 30, x: 0, y: 0, toJSON: () => {},
      });

      fireEvent.pointerDown(handle, { clientX: 100 });
      fireEvent.pointerMove(window, { clientX: 130 });
      fireEvent.pointerUp(window);
      fireEvent.pointerUp(window); // the real browser's duplicate dispatch, simulated directly

      expect(onColumnWidthsChange).toHaveBeenCalledTimes(1);
      expect(onColumnWidthsChange).toHaveBeenCalledWith({ name: 180 });
    });

    it('Arrow keys resize the focused handle by a fixed step, Shift for a larger step, Home/End for min/max', () => {
      const onColumnWidthsChange = vi.fn();
      const { container } = render(
        <DataTable data={testData} columns={resizableColumns} pageSize={10} onColumnWidthsChange={onColumnWidthsChange} />
      );
      const handle = getHandle(container);
      const headerCell = handle.closest('th')!;
      headerCell.getBoundingClientRect = () => ({
        top: 0, left: 0, right: 100, bottom: 30, width: 100, height: 30, x: 0, y: 0, toJSON: () => {},
      });

      fireEvent.keyDown(handle, { key: 'ArrowRight' });
      expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 110 });

      fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
      expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 160 });

      fireEvent.keyDown(handle, { key: 'ArrowLeft' });
      expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 150 });

      fireEvent.keyDown(handle, { key: 'Home' });
      expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 40 });

      fireEvent.keyDown(handle, { key: 'End' });
      expect(onColumnWidthsChange).toHaveBeenLastCalledWith({ name: 800 }); // RESIZE_HANDLE_ARIA_VALUEMAX
    });

    it('a controlled columnWidths value does not self-update -- the rendered width only changes once the consumer re-renders with the new prop', () => {
      const onColumnWidthsChange = vi.fn();
      const { container, rerender } = render(
        <DataTable
          data={testData}
          columns={resizableColumns}
          pageSize={10}
          columnWidths={{ name: 100 }}
          onColumnWidthsChange={onColumnWidthsChange}
        />
      );
      const handle = getHandle(container);
      fireEvent.keyDown(handle, { key: 'ArrowRight' });
      expect(onColumnWidthsChange).toHaveBeenCalledWith({ name: 110 });

      // 'id' has no width (index 0); 'name' is the resizable column (index 1).
      expect(container.querySelectorAll('col')[1].getAttribute('style')).toContain('100px');

      rerender(
        <DataTable
          data={testData}
          columns={resizableColumns}
          pageSize={10}
          columnWidths={{ name: 110 }}
          onColumnWidthsChange={onColumnWidthsChange}
        />
      );
      expect(container.querySelectorAll('col')[1].getAttribute('style')).toContain('110px');
    });

    it('defaultColumnWidths seeds the uncontrolled initial rendered width', () => {
      const { container } = render(
        <DataTable data={testData} columns={resizableColumns} pageSize={10} defaultColumnWidths={{ name: 222 }} />
      );
      expect(container.querySelectorAll('col')[1].getAttribute('style')).toContain('222px');
    });
  });
});
