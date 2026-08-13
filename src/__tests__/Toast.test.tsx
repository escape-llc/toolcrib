import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../components/Toast/ToastContext';
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

    // Fast-forward duration timer (100ms)
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

    expect(dismissedFn).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-toast-1',
        reason: 'action',
      })
    );

    unsub1();
    unsub2();
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
});
