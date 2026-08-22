import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BarChart } from '../components/Chart/BarChart';

const categories = ['Q1', 'Q2'];
const oneSeries = [{ label: 'Revenue', values: [10, 20] }];
const twoSeries = [
  { label: 'Revenue', values: [10, 20] },
  { label: 'Cost', values: [5, 8] },
];

describe('BarChart', () => {
  it('renders one bar per category-series pair', () => {
    const { container } = render(<BarChart categories={categories} series={twoSeries} />);
    expect(container.querySelectorAll('[aria-roledescription="bar"]')).toHaveLength(4);
  });

  it('shows no legend for a single series, but shows one for multiple', () => {
    const { rerender } = render(<BarChart categories={categories} series={oneSeries} />);
    expect(screen.queryByRole('list', { name: 'Legend' })).not.toBeInTheDocument();

    rerender(<BarChart categories={categories} series={twoSeries} />);
    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(legend).toHaveTextContent('Revenue');
    expect(legend).toHaveTextContent('Cost');
  });

  it('colors each series from the fixed categorical palette, in order', () => {
    const { container } = render(<BarChart categories={categories} series={twoSeries} />);
    const bars = container.querySelectorAll('[aria-roledescription="bar"]');
    // 2 categories x 2 series = 4 bars; series 0 (Revenue) then series 1 (Cost) within each category group.
    expect(bars[0]).toHaveAttribute('fill', 'var(--ai-chart-series-1)');
    expect(bars[1]).toHaveAttribute('fill', 'var(--ai-chart-series-2)');
  });

  it('shows a tooltip with category and value on hover, hides on pointer leave', () => {
    const { container } = render(<BarChart categories={categories} series={oneSeries} />);
    const bar = container.querySelector('[aria-roledescription="bar"]')!;

    fireEvent.pointerMove(bar);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Q1');
    expect(tooltip).toHaveTextContent('Revenue');
    expect(tooltip).toHaveTextContent('10');

    fireEvent.pointerLeave(bar);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the same tooltip on keyboard focus, hides on blur', () => {
    const { container } = render(<BarChart categories={categories} series={oneSeries} />);
    const bar = container.querySelector('[aria-roledescription="bar"]')!;

    fireEvent.focus(bar);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Q1');

    fireEvent.blur(bar);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('is keyboard-focusable per bar', () => {
    const { container } = render(<BarChart categories={categories} series={oneSeries} />);
    container.querySelectorAll('[aria-roledescription="bar"]').forEach(bar => {
      expect(bar).toHaveAttribute('tabindex', '0');
    });
  });
});
