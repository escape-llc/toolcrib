import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sparkline } from '../components/Chart/Sparkline';

describe('Sparkline', () => {
  it('renders a single line path for the trend', () => {
    const { container } = render(<Sparkline values={[1, 3, 2, 5, 4]} />);
    expect(container.querySelectorAll('path')).toHaveLength(1);
  });

  it('marks the last value with an accent-colored endpoint', () => {
    const { container } = render(<Sparkline values={[1, 3, 2, 5, 4]} />);
    const dot = container.querySelector('circle');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveAttribute('fill', 'var(--ai-color-accent)');
  });

  it('renders nothing but the frame for an empty series, without throwing', () => {
    const { container } = render(<Sparkline values={[]} />);
    expect(container.querySelector('circle')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('has an accessible name', () => {
    render(<Sparkline values={[1, 2, 3]} title="Revenue trend" />);
    expect(screen.getByRole('img', { name: 'Revenue trend' })).toBeInTheDocument();
  });
});
