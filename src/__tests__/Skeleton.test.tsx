import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '../components/Skeleton/Skeleton';

describe('Skeleton', () => {
  it('renders a text shape by default, full width and a small fixed height', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('100%');
    expect(el.style.height).toBe('1rem');
  });

  it('renders a circle with matching width/height when only one is given', () => {
    const { container } = render(<Skeleton shape="circle" width="3rem" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('3rem');
    expect(el.style.height).toBe('3rem');
  });

  it('renders a rect shape with its own default height', () => {
    const { container } = render(<Skeleton shape="rect" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.height).toBe('8rem');
  });

  it('uses the shared ai-skeleton-shimmer keyframe, not a hardcoded one-off duration lifted from another slice', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.animation).toContain('ai-skeleton-shimmer');
  });

  it('is hidden from the accessibility tree — a loading placeholder, not real content', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveAttribute('aria-hidden', 'true');
  });
});
