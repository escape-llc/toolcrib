import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PieChart } from '../components/Chart/PieChart';

describe('PieChart', () => {
  it('renders one slice per datum', () => {
    const { container } = render(
      <PieChart data={[{ label: 'A', value: 10 }, { label: 'B', value: 20 }, { label: 'C', value: 30 }]} />
    );
    expect(container.querySelectorAll('[aria-roledescription="slice"]')).toHaveLength(3);
  });

  it('folds more than 8 slices into "Other", keeping the largest 7 as their own slice', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({ label: `Item ${i}`, value: i + 1 }));
    const { container } = render(<PieChart data={data} />);
    const slices = container.querySelectorAll('[aria-roledescription="slice"]');
    expect(slices).toHaveLength(8);

    const legend = screen.getByRole('list', { name: 'Legend' });
    expect(legend).toHaveTextContent('Other');
    // The 3 smallest values (1, 2, 3) fold into Other; the 7 largest (4-10) keep their own label.
    expect(legend).toHaveTextContent('Item 9');
    expect(legend).not.toHaveTextContent('Item 0');
  });

  it('shows no legend for a single slice, but shows one for multiple', () => {
    const { rerender } = render(<PieChart data={[{ label: 'A', value: 10 }]} />);
    expect(screen.queryByRole('list', { name: 'Legend' })).not.toBeInTheDocument();

    rerender(<PieChart data={[{ label: 'A', value: 10 }, { label: 'B', value: 20 }]} />);
    expect(screen.getByRole('list', { name: 'Legend' })).toBeInTheDocument();
  });

  it('shows label, value, and percentage in the tooltip on hover', () => {
    const { container } = render(<PieChart data={[{ label: 'A', value: 25 }, { label: 'B', value: 75 }]} />);
    const firstSlice = container.querySelector('[aria-roledescription="slice"]')!;

    fireEvent.pointerMove(firstSlice);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('A');
    expect(tooltip).toHaveTextContent('25');
    expect(tooltip).toHaveTextContent('25.0%');

    fireEvent.pointerLeave(firstSlice);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the same tooltip on keyboard focus', () => {
    const { container } = render(<PieChart data={[{ label: 'A', value: 25 }, { label: 'B', value: 75 }]} />);
    const firstSlice = container.querySelector('[aria-roledescription="slice"]')!;

    fireEvent.focus(firstSlice);
    expect(screen.getByRole('tooltip')).toHaveTextContent('A');

    fireEvent.blur(firstSlice);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('renders an empty state instead of a broken chart when there is no data', () => {
    const { container } = render(<PieChart data={[]} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(screen.getByText('No data to display')).toBeInTheDocument();
  });
});
