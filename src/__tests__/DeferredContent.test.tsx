import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeferredContent } from '../components/Layout/DeferredContent';
import { axe } from './testUtils/axe';

describe('DeferredContent', () => {
  it('renders its children', async () => {
    render(
      <DeferredContent estimatedHeight={200}>
        <p>Hello</p>
      </DeferredContent>
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(await axe(document.body)).toHaveNoViolations();
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

  // Issue #634: the browser fires contentvisibilityautostatechange once, in
  // the first rendering update after the element is inserted -- which can
  // come before a useEffect subscription runs (confirmed in real WebKit and
  // Chromium: a listener attached ~100ms after insertion never saw an
  // on-screen element's initial event). A parent's layout effect runs in
  // the same commit, before any passive effect, so dispatching from one
  // stands in for that first rendering update.
  it('is subscribed before the first rendering update, so the initial visibility event is not missed', () => {
    const onVisibilityChange = vi.fn();
    function FiresOnCommit({ children }: { children: React.ReactNode }) {
      const ref = React.useRef<HTMLDivElement>(null);
      React.useLayoutEffect(() => {
        const event = new Event('contentvisibilityautostatechange') as Event & { skipped: boolean };
        event.skipped = false;
        ref.current?.firstElementChild?.dispatchEvent(event);
      }, []);
      return <div ref={ref}>{children}</div>;
    }
    render(
      <FiresOnCommit>
        <DeferredContent estimatedHeight={200} onVisibilityChange={onVisibilityChange}>
          <p>Content</p>
        </DeferredContent>
      </FiresOnCommit>
    );
    expect(onVisibilityChange).toHaveBeenCalledWith({ skipped: false });
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
