import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable, Column } from '../components/DataTable/DataTable';

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
});
