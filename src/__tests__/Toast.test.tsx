import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { type ToastAnchor, ToastProvider, useToast } from '../components/Toast/ToastContext';
import { ToastContainer } from '../components/Toast/Toast';
import { aiBus } from '../eventBus/eventBus';

const TestComponent = ({ onActionClick }: { onActionClick?: () => void }) => {
  const { addToast } = useToast();
  return (
    <div>
      <button
        onClick={() =>
          addToast({
            id: 'test-toast-1',
            type: 'info',
            message: 'Toast message',
            duration: 100,
            actions: [
              {
                label: 'Retry Action',
                onClick: () => {
                  if (onActionClick) onActionClick();
                },
              },
            ],
          })
        }
      >
        Trigger Toast
      </button>
      <ToastContainer />
    </div>
  );
};

describe('Toast Subsystem Event Generation', () => {
  it('emits toast:added and toast:expired events automatically', async () => {
    vi.useFakeTimers();
    const addedFn = vi.fn();
    const expiredFn = vi.fn();
    const dismissedFn = vi.fn();

    const unsub1 = aiBus.on('toast:added', addedFn);
    const unsub2 = aiBus.on('toast:expired', expiredFn);
    const unsub3 = aiBus.on('toast:dismissed', dismissedFn);

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Trigger Toast'));

    expect(addedFn).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-toast-1',
        type: 'info',
        message: 'Toast message',
      })
    );

    // Fast-forward past the 100ms duration timer — this triggers Radix's
    // onOpenChange(false), which emits toast:expired synchronously but only
    // *schedules* a single 1000ms backstop before dismissToast() actually
    // runs, normally preempted by a real exit-animation animationend (see
    // Toast.tsx's own comment on why dismissToast is deferred at all).
    // jsdom never fires a real animationend, so the backstop is the only
    // thing that will ever resolve it here.
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(expiredFn).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-toast-1',
        message: 'Toast message',
        type: 'info',
      })
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(dismissedFn).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-toast-1',
        reason: 'expired',
      })
    );

    unsub1();
    unsub2();
    unsub3();
    vi.useRealTimers();
  });

  it('emits toast:action_clicked and toast:dismissed with reason="action" when action button is clicked', () => {
    // Fake timers, same reason as the expiry test above: dismissToast()
    // (and its toast:dismissed emission) is deferred until both the exit
    // animation would fire a real animationend, which jsdom never
    // produces, so only the single 1000ms backstop timer resolves it here.
    vi.useFakeTimers();
    const actionClickedFn = vi.fn();
    const dismissedFn = vi.fn();
    const customActionCallback = vi.fn();

    const unsub1 = aiBus.on('toast:action_clicked', actionClickedFn);
    const unsub2 = aiBus.on('toast:dismissed', dismissedFn);

    render(
      <ToastProvider>
        <TestComponent onActionClick={customActionCallback} />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Trigger Toast'));
    fireEvent.click(screen.getByText('Retry Action'));

    expect(customActionCallback).toHaveBeenCalledTimes(1);
    expect(actionClickedFn).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-toast-1',
        actionLabel: 'Retry Action',
        message: 'Toast message',
      })
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(dismissedFn).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-toast-1',
        reason: 'action',
      })
    );

    unsub1();
    unsub2();
    vi.useRealTimers();
  });

  it('keeps sticky toasts on screen without auto-expiring until user dismisses', () => {
    vi.useFakeTimers();
    const expiredFn = vi.fn();
    const unsub = aiBus.on('toast:expired', expiredFn);

    const StickyComponent = () => {
      const { addToast } = useToast();
      return (
        <div>
          <button onClick={() => addToast({ id: 'sticky-1', type: 'error', message: 'Sticky alert', sticky: true, title: 'Alert' })}>
            Trigger Sticky
          </button>
          <ToastContainer />
        </div>
      );
    };

    render(
      <ToastProvider>
        <StickyComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Trigger Sticky'));

    expect(screen.getByText('Sticky alert')).toBeInTheDocument();
    expect(screen.getByText('📌 Sticky')).toBeInTheDocument();

    // Fast-forward 10 seconds - sticky toast should NOT expire
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(expiredFn).not.toHaveBeenCalled();
    expect(screen.getByText('Sticky alert')).toBeInTheDocument();

    // User dismisses sticky toast
    fireEvent.click(screen.getByLabelText('Dismiss toast'));
    expect(screen.queryByText('Sticky alert')).not.toBeInTheDocument();

    unsub();
    vi.useRealTimers();
  });

  // Regression: ToastPrimitive.Root portals its real rendered output to be a
  // direct child of the Viewport's <ol> — a per-toast wrapper <div> in JSX
  // does NOT end up as this element's DOM ancestor, so setting
  // pointerEvents: 'auto' on that wrapper (the previous implementation)
  // silently did nothing. Since the Viewport itself sets pointerEvents:
  // 'none' (so empty space around toasts stays click-through), every toast
  // — and everything inside it, including the dismiss/action buttons —
  // inherited 'none' and swallowed every click. Confirmed via a real browser
  // run (DOM dump + computed-style walk), not just reasoning about it; see
  // Toast.tsx's own comment on this element. This asserts the fix directly
  // on the rendered node's own inline style, which is what a jsdom test can
  // actually observe (jsdom doesn't compute real inherited pointer-events
  // the way a browser's hit-testing does).
  it('sets pointerEvents: auto directly on the toast root, not on a wrapper the portal bypasses', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Trigger Toast'));
    const toastEl = screen.getByTestId('toast-item');
    expect(toastEl.style.pointerEvents).toBe('auto');
  });

  describe.each(['success', 'warning'] as const)('%s toast type', (type) => {
    it(`renders the ${type} subtheme's color/background/border branches`, () => {
      const TypedComponent = () => {
        const { addToast } = useToast();
        return (
          <div>
            <button onClick={() => addToast({ id: `typed-${type}`, type, message: `${type} message` })}>
              Trigger
            </button>
            <ToastContainer />
          </div>
        );
      };

      render(
        <ToastProvider>
          <TypedComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Trigger'));
      expect(screen.getByText(`${type} message`)).toBeInTheDocument();
    });
  });

  it('onAnimationEnd ignores an unrelated animationName and does not finalize the toast', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Trigger Toast'));
    const toastEl = screen.getByTestId('toast-item');

    // Firing animationEnd BEFORE any dismiss request keeps the toast node
    // mounted (jsdom's Radix Presence removes it as soon as `open` actually
    // flips false, since jsdom never reports a real running CSS animation —
    // same reason the rest of this file relies on the setTimeout backstops
    // instead of real animation events). This only exercises the handler
    // being wired up and its animationName guard, not a real dismiss flow.
    fireEvent.animationEnd(toastEl, { animationName: 'not-a-toast-animation' });
    expect(screen.getByTestId('toast-item')).toBeInTheDocument();
  });

  describe.each([
    ['top-left', 'top: 0px; left: 0px;'],
    ['bottom-right', 'bottom: 0px; right: 0px;'],
    ['bottom-left', 'bottom: 0px; left: 0px;'],
    ['top-center', 'top: 0px; left: 50%;'],
    ['bottom-center', 'bottom: 0px; left: 50%;'],
  ] as [ToastAnchor, string][])('anchor "%s"', (anchor, expectedCss) => {
    it('positions the toast viewport at the correct screen corner/edge', () => {
      render(
        <ToastProvider defaultAnchor={anchor}>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Trigger Toast'));
      // ToastPrimitive.Viewport renders as a plain <ol> with no distinguishing
      // role/label — the toast list itself, found via its known children.
      const viewport = screen.getByText('Toast message').closest('ol')!;
      for (const declaration of expectedCss.split(';').filter(Boolean)) {
        const [prop, value] = declaration.trim().split(':').map(s => s.trim());
        expect(viewport.style.getPropertyValue(prop)).toBe(value);
      }
    });
  });

  it('clearAll dismisses every visible toast at once', () => {
    const ClearAllComponent = () => {
      const { addToast, clearAll } = useToast();
      return (
        <div>
          <button onClick={() => { addToast({ id: 'a', type: 'info', message: 'A' }); addToast({ id: 'b', type: 'info', message: 'B' }); }}>
            Trigger Both
          </button>
          <button onClick={clearAll}>Clear All</button>
          <ToastContainer />
        </div>
      );
    };

    render(
      <ToastProvider>
        <ClearAllComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Trigger Both'));
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear All'));
    expect(screen.queryByText('A')).not.toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
  });

  it('the toast:shown event bus channel adds a toast the same way addToast does', () => {
    render(
      <ToastProvider>
        <ToastContainer />
      </ToastProvider>
    );

    act(() => {
      aiBus.emit('toast:shown', { id: 'bus-toast', type: 'info', message: 'From the bus', priority: 'high' });
    });

    expect(screen.getByText('From the bus')).toBeInTheDocument();
  });

  it('useToast throws when called outside a ToastProvider', () => {
    const Orphan = () => {
      useToast();
      return null;
    };
    // Expected error boundary output — React logs the thrown error to
    // console.error even when the test itself catches it via expect().toThrow.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => render(<Orphan />)).toThrow('useToast must be used within a ToastProvider');
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
