import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeferredContent } from '../components/Layout/DeferredContent';

describe('DeferredContent', () => {
  it('renders its children', () => {
    render(
      <DeferredContent estimatedHeight={200}>
        <p>Hello</p>
      </DeferredContent>
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('applies content-visibility: auto and contain-intrinsic-height from estimatedHeight', () => {
    render(
      <DeferredContent estimatedHeight={250}>
        <p>Content</p>
      </DeferredContent>
    );
    const root = screen.getByText('Content').parentElement as HTMLElement;
    expect(root.style.contentVisibility).toBe('auto');
    expect(root.style.containIntrinsicHeight).toBe('auto 250px');
  });

  it('calls onVisibilityChange when the native contentvisibilityautostatechange event fires', () => {
    const onVisibilityChange = vi.fn();
    render(
      <DeferredContent estimatedHeight={200} onVisibilityChange={onVisibilityChange}>
        <p>Content</p>
      </DeferredContent>
    );
    const root = screen.getByText('Content').parentElement as HTMLElement;

    // jsdom doesn't implement content-visibility, so the real browser event
    // never fires here — dispatch it manually to verify the listener is
    // correctly wired and forwards `skipped` through untouched.
    const event = new Event('contentvisibilityautostatechange') as Event & { skipped: boolean };
    event.skipped = true;
    root.dispatchEvent(event);

    expect(onVisibilityChange).toHaveBeenCalledWith({ skipped: true });
  });

  it('does not throw when onVisibilityChange is omitted', () => {
    render(
      <DeferredContent estimatedHeight={200}>
        <p>Content</p>
      </DeferredContent>
    );
    const root = screen.getByText('Content').parentElement as HTMLElement;
    expect(() => root.dispatchEvent(new Event('contentvisibilityautostatechange'))).not.toThrow();
  });
});
