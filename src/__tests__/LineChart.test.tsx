import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LineChart } from '../components/Chart/LineChart';

const categories = ['Jan', 'Feb', 'Mar'];
const oneSeries = [{ label: 'Revenue', values: [10, 20, 15] }];
const twoSeries = [
  { label: 'Revenue', values: [10, 20, 15] },
  { label: 'Cost', values: [5, 8, 6] },
];

describe('LineChart', () => {
  it('renders one line path per series', () => {
    const { container } = render(<LineChart categories={categories} series={twoSeries} />);
    expect(container.querySelectorAll('path')).toHaveLength(2);
  });

  it('shows no legend for a single series, but shows one for multiple', () => {
    const { rerender } = render(<LineChart categories={categories} series={oneSeries} />);
    expect(screen.queryByRole('list', { name: 'Legend' })).not.toBeInTheDocument();

    rerender(<LineChart categories={categories} series={twoSeries} />);
    expect(screen.getByRole('list', { name: 'Legend' })).toBeInTheDocument();
  });

  it('shows every series value in one shared tooltip on keyboard focus', () => {
    render(<LineChart categories={categories} series={twoSeries} />);
    const overlay = screen.getByRole('img');

    fireEvent.focus(overlay);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Jan');
    expect(tooltip).toHaveTextContent('Revenue');
    expect(tooltip).toHaveTextContent('10');
    expect(tooltip).toHaveTextContent('Cost');
    expect(tooltip).toHaveTextContent('5');
  });

  it('steps through categories with arrow keys, clamped at the domain edges', () => {
    render(<LineChart categories={categories} series={oneSeries} />);
    const overlay = screen.getByRole('img');

    fireEvent.focus(overlay);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Jan');

    fireEvent.keyDown(overlay, { key: 'ArrowRight' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Feb');

    fireEvent.keyDown(overlay, { key: 'ArrowRight' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Mar');

    // Clamped: one more ArrowRight past the last category stays on Mar.
    fireEvent.keyDown(overlay, { key: 'ArrowRight' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Mar');

    fireEvent.keyDown(overlay, { key: 'ArrowLeft' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('Feb');
  });

  it('hides the tooltip on Escape and on blur', () => {
    render(<LineChart categories={categories} series={oneSeries} />);
    const overlay = screen.getByRole('img');

    fireEvent.focus(overlay);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    fireEvent.keyDown(overlay, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(overlay);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(overlay);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('describes the current data point in the overlay\'s accessible name before any interaction', () => {
    render(<LineChart categories={categories} series={oneSeries} title="Quarterly revenue" />);
    expect(screen.getByRole('img', { name: /Quarterly revenue/ })).toBeInTheDocument();
  });

  it('renders an empty state instead of a broken chart when there is no data', () => {
    const { container } = render(<LineChart categories={[]} series={[]} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(screen.getByText('No data to display')).toBeInTheDocument();
  });

  describe('variant="area"', () => {
    it('renders a fill plus an edge line per series', () => {
      const { container } = render(<LineChart categories={categories} series={twoSeries} variant="area" />);
      // 2 series x (1 Area fill + 1 LinePath edge) = 4 paths, vs 2 in line mode.
      expect(container.querySelectorAll('path')).toHaveLength(4);
    });

    it('stacks multi-series bands, so the y-axis domain covers the summed total rather than the single max', () => {
      const stackedSeries = [
        { label: 'A', values: [10] },
        { label: 'B', values: [20] },
      ];
      const maxTick = (container: HTMLElement) =>
        Math.max(
          ...Array.from(container.querySelectorAll('svg text'))
            .map(t => Number(t.textContent))
            .filter(n => !Number.isNaN(n))
        );

      const { container: lineContainer } = render(<LineChart categories={['Jan']} series={stackedSeries} variant="line" />);
      const { container: areaContainer } = render(<LineChart categories={['Jan']} series={stackedSeries} variant="area" />);

      // Line mode's domain only needs to cover the single largest value (20);
      // area mode stacks both series, so it needs to cover their sum (30).
      expect(maxTick(areaContainer)).toBeGreaterThan(maxTick(lineContainer));
    });

    it('still reports each series\' own value in the tooltip, not its stacked band position', () => {
      const stackedSeries = [
        { label: 'A', values: [10] },
        { label: 'B', values: [20] },
      ];
      render(<LineChart categories={['Jan']} series={stackedSeries} variant="area" />);
      const overlay = screen.getByRole('img');

      fireEvent.focus(overlay);
      const tooltip = screen.getByRole('tooltip');
      expect(tooltip).toHaveTextContent('A');
      expect(tooltip).toHaveTextContent('10');
      expect(tooltip).toHaveTextContent('B');
      expect(tooltip).toHaveTextContent('20');
    });
  });
});
