import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Progress } from '../components/Progress/Progress';
import { Separator } from '../components/Separator/Separator';
import { Avatar } from '../components/Avatar/Avatar';
import { aiBus } from '../eventBus/eventBus';

describe('Progress Component', () => {
  it('reflects value/max via aria attributes and clamps out-of-range values', () => {
    const { rerender } = render(<Progress value={40} max={80} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    expect(bar).toHaveAttribute('aria-valuemax', '80');

    // Clamped, not passed straight through — a value above max (or below
    // 0) would otherwise push Radix's own indicator transform past 100%.
    rerender(<Progress value={999} max={80} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '80');
  });

  it('emits progress:changed whenever value/max change', () => {
    const changedFn = vi.fn();
    const unsub = aiBus.on('progress:changed', changedFn);

    const { rerender } = render(<Progress id="upload" value={10} />);
    expect(changedFn).toHaveBeenCalledWith({ id: 'upload', value: 10, max: 100 });

    rerender(<Progress id="upload" value={55} />);
    expect(changedFn).toHaveBeenCalledWith({ id: 'upload', value: 55, max: 100 });

    unsub();
  });
});

describe('Separator Component', () => {
  it('renders with the correct orientation', () => {
    // decorative={false} needed to get the semantic separator role at all
    // — see the next test for the decorative (default) case, where Radix
    // deliberately omits it.
    render(<Separator orientation="vertical" decorative={false} />);
    expect(screen.getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('is not exposed to assistive tech when decorative (the default)', () => {
    render(<Separator />);
    // Radix omits the separator role entirely for decorative instances —
    // there is nothing for assistive tech to announce.
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });
});

describe('Avatar Component', () => {
  // Regression: fallbackDelayMs originally defaulted to 300 rather than
  // undefined. Radix's AvatarPrimitive.Fallback only renders immediately
  // when its own delayMs prop is literally undefined (its internal
  // `canRender` state starts true only in that case) — passing any numeric
  // default, even one meant just to "avoid flicker," forces every avatar
  // with no src (the common initials-only case) to render blank until that
  // timer fires. Caught by this exact assertion failing synchronously
  // before the fix.
  it('renders the fallback immediately with no src, with no artificial delay', () => {
    render(<Avatar fallback="JD" alt="Jane Doe" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('honors an explicit fallbackDelayMs, not rendering the fallback until it elapses', () => {
    vi.useFakeTimers();
    render(<Avatar fallback="JD" alt="Jane Doe" fallbackDelayMs={300} />);

    expect(screen.queryByText('JD')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByText('JD')).toBeInTheDocument();

    vi.useRealTimers();
  });
});
