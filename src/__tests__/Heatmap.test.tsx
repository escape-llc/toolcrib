import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Heatmap } from '../components/Chart/Heatmap';

const columns = ['Mon', 'Tue', 'Wed'];
const rows = ['AM', 'PM'];
const values = [
  [1, 5, 9],
  [3, 7, 2],
];

describe('Heatmap', () => {
  it('renders one cell per row-column pair', () => {
    const { container } = render(<Heatmap columns={columns} rows={rows} values={values} />);
    expect(container.querySelectorAll('[aria-roledescription="cell"]')).toHaveLength(6);
  });

  it('colors cells from the theme-tracking sequential ramp, not the fixed categorical palette', () => {
    const { container } = render(<Heatmap columns={columns} rows={rows} values={values} />);
    const cells = container.querySelectorAll('[aria-roledescription="cell"]');
    cells.forEach(cell => {
      expect(cell.getAttribute('fill')).toContain('color-mix');
      expect(cell.getAttribute('fill')).toContain('var(--ai-color-primary)');
    });
  });

  it('gives the highest-value cell more of the primary color mixed in than the lowest', () => {
    const { container } = render(<Heatmap columns={columns} rows={rows} values={values} />);
    const cells = Array.from(container.querySelectorAll('[aria-roledescription="cell"]'));
    const pctOf = (el: Element) => Number(el.getAttribute('fill')?.match(/primary\)\s*(\d+(?:\.\d+)?)%/)?.[1]);

    const lowCell = cells.find(c => c.getAttribute('aria-label')?.includes(': 1'))!;
    const highCell = cells.find(c => c.getAttribute('aria-label')?.includes(': 9'))!;
    expect(pctOf(highCell)).toBeGreaterThan(pctOf(lowCell));
  });

  it('shows row, column, and formatted value in the tooltip on hover', () => {
    const { container } = render(
      <Heatmap columns={columns} rows={rows} values={values} formatValue={v => `${v}h`} />
    );
    const cell = container.querySelector('[aria-label="AM, Mon: 1h"]')!;

    fireEvent.pointerMove(cell);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('AM, Mon');
    expect(tooltip).toHaveTextContent('1h');

    fireEvent.pointerLeave(cell);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('is keyboard-focusable per cell, with the same tooltip on focus', () => {
    const { container } = render(<Heatmap columns={columns} rows={rows} values={values} />);
    const cell = container.querySelector('[aria-label="PM, Wed: 2"]')!;
    expect(cell).toHaveAttribute('tabindex', '0');

    fireEvent.focus(cell);
    expect(screen.getByRole('tooltip')).toHaveTextContent('PM, Wed');
    fireEvent.blur(cell);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
