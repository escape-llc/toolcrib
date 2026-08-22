import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScaleLegend } from '../components/Chart/ScaleLegend';

describe('ScaleLegend', () => {
  it('shows the min and max labels', () => {
    render(<ScaleLegend min={0} max={100} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('formats labels with a custom formatter', () => {
    render(<ScaleLegend min={0} max={24} formatValue={v => `${v} tickets`} />);
    expect(screen.getByText('0 tickets')).toBeInTheDocument();
    expect(screen.getByText('24 tickets')).toBeInTheDocument();
  });

  it('has an accessible name describing the range', () => {
    render(<ScaleLegend min={1} max={9} formatValue={v => `${v}h`} />);
    expect(screen.getByRole('img', { name: 'Scale from 1h to 9h' })).toBeInTheDocument();
  });

  it('draws the gradient from the shared sequential ramp, matching Heatmap\'s own cell colors', () => {
    const { container } = render(<ScaleLegend min={0} max={1} />);
    const bar = container.querySelector('[role="img"]') as HTMLElement;
    expect(bar.style.background).toContain('linear-gradient');
    expect(bar.style.background).toContain('var(--ai-color-primary)');
  });
});
