import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { type ToastAnchor, ToastProvider, useToast, useToastActions } from '../components/Toast/ToastContext';
import { ToastContainer } from '../components/Toast/Toast';
import { aiBus } from '../eventBus/eventBus';
import { axe } from './testUtils/axe';

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
  it('sets pointerEvents: auto directly on the toast root, not on a wrapper the portal bypasses', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    // Closed/empty-state scan: ToastContainer's own Viewport portal is
    // mounted but holds no toast yet -- genuinely different DOM from the
    // populated state scanned below. Not done in the fake-timers tests
    // above -- vi.useFakeTimers() there starves axe-core's own internal
    // async scheduling (a real, confirmed deadlock: the scan never
    // resolves until the 5s real-time test-timeout watchdog fires), so
    // this plain, real-timers test is where both states get scanned
    // instead.
    expect(await axe(document.body)).toHaveNoViolations();

    fireEvent.click(screen.getByText('Trigger Toast'));
    const toastEl = screen.getByTestId('toast-item');
    expect(toastEl.style.pointerEvents).toBe('auto');
    // Open/populated-state scan: a real toast with a message, an action
    // button, and the always-present dismiss button -- the portal's real
    // content, not just its empty shell.
    expect(await axe(document.body)).toHaveNoViolations();
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

  // The toast Root itself (not just the Viewport, covered above) is now
  // ALSO independently positioned per-anchor -- see Toast.tsx's own
  // comment on why (Root's real rendered output is a portaled direct
  // child of the Viewport's <ol>, sharing its containing block, so
  // absolute positioning has to be set on Root directly for the stacking
  // transform to work at all). All 6 anchors, unlike the Viewport-only
  // describe.each above (which omits the default 'top-right') -- this is
  // new logic this PR introduced, so every anchor's own branch matters,
  // including the default.
  const INSET = '1rem';
  // Every non-anchored side is explicit 'auto' (not omitted / '') -- see
  // ToastItemComponent's own comment on why: a real, confirmed Chromium
  // quirk left a stale static-position in place unless the opposite side
  // is set to 'auto' explicitly, from the very first render.
  describe.each([
    ['top-right', { top: INSET, right: INSET, left: 'auto', bottom: 'auto' }, false],
    ['top-left', { top: INSET, left: INSET, right: 'auto', bottom: 'auto' }, false],
    ['bottom-right', { bottom: INSET, right: INSET, top: 'auto', left: 'auto' }, false],
    ['bottom-left', { bottom: INSET, left: INSET, top: 'auto', right: 'auto' }, false],
    ['top-center', { top: INSET, left: '50%', right: 'auto', bottom: 'auto' }, true],
    ['bottom-center', { bottom: INSET, left: '50%', right: 'auto', top: 'auto' }, true],
  ] as [ToastAnchor, Record<'top' | 'bottom' | 'left' | 'right', string>, boolean][])(
    'anchor "%s"',
    (anchor, expectedEdges, expectsCentering) => {
      it('positions the toast Root itself at the matching edge(s), and only sets --toast-transform-base for a center anchor', () => {
        render(
          <ToastProvider defaultAnchor={anchor}>
            <TestComponent />
          </ToastProvider>
        );

        fireEvent.click(screen.getByText('Trigger Toast'));
        const toastEl = screen.getByTestId('toast-item');
        expect(toastEl.style.top).toBe(expectedEdges.top);
        expect(toastEl.style.bottom).toBe(expectedEdges.bottom);
        expect(toastEl.style.left).toBe(expectedEdges.left);
        expect(toastEl.style.right).toBe(expectedEdges.right);
        expect(toastEl.style.getPropertyValue('--toast-transform-base')).toBe(expectsCentering ? 'translateX(-50%)' : '');
      });
    }
  );

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

  // Regression for issue #379: addToast used to re-sort the WHOLE toasts
  // array by priority on every insert, so a low-priority toast fired FIRST
  // could end up stacked visually below a high-priority toast fired LATER
  // -- direct report was that toasts should simply stack in the order they
  // were triggered (FIFO), with priority left to independently control
  // duration/stickiness only (already true via isSticky's own
  // priority === 'urgent' check, untouched by this fix).
  it("toasts stack in FIFO (insertion) order, regardless of priority -- a low-priority toast fired first stays ahead of a later high-priority one", () => {
    const PriorityComponent = () => {
      const { addToast } = useToast();
      return (
        <div>
          <button
            onClick={() => {
              addToast({ id: 'first', type: 'info', message: 'Fired first', priority: 'low' });
              addToast({ id: 'second', type: 'info', message: 'Fired second', priority: 'urgent' });
              addToast({ id: 'third', type: 'info', message: 'Fired third', priority: 'medium' });
            }}
          >
            Trigger Three
          </button>
          <ToastContainer />
        </div>
      );
    };

    render(
      <ToastProvider>
        <PriorityComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText('Trigger Three'));

    // DOM order reflects the underlying `toasts` array's own insertion
    // order directly (ToastContainer maps over it with no re-sort of its
    // own) -- exactly the order they were triggered in, not priority.
    const messages = screen.getAllByTestId('toast-item').map(el => el.textContent);
    expect(messages[0]).toContain('Fired first');
    expect(messages[1]).toContain('Fired second');
    expect(messages[2]).toContain('Fired third');
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

  // Regression for the "toasts jerk around instead of smoothly transitioning"
  // report -- ToastContainer used to reflow the whole flex list via a
  // grid-template-rows collapse on every frame of every toast's own exit
  // animation, a real layout recalculation. It's now pure arithmetic: each
  // toast's own `--stack-offset` CSS variable, computed from every OTHER
  // visible toast's own (measured, or -- as here, in jsdom, which has no
  // ResizeObserver/layout engine -- estimated) height, animated via a plain
  // `transform: translateY(...)` transition instead of reflow. jsdom can't
  // observe the actual smoothness (that's what the real-browser e2e spec is
  // for), but it CAN observe the underlying arithmetic directly.
  describe('stacking via --stack-offset (Toast transition smoothness)', () => {
    const StackComponent = () => {
      const { addToast } = useToast();
      return (
        <div>
          <button onClick={() => addToast({ id: 'a', type: 'info', message: 'Toast A' })}>Add A</button>
          <button onClick={() => addToast({ id: 'b', type: 'info', message: 'Toast B' })}>Add B</button>
          <button onClick={() => addToast({ id: 'c', type: 'info', message: 'Toast C' })}>Add C</button>
          <ToastContainer />
        </div>
      );
    };

    // jsdom's getBoundingClientRect always returns an all-zero rect (no real
    // layout engine) and has no ResizeObserver at all -- useAdaptiveSize's
    // height guard (`height > 0`) means onHeightChange never actually fires
    // here, so every toast falls back to TOAST_ESTIMATED_HEIGHT_PX (72) for
    // this whole describe block. That's fine: these tests are about the
    // OFFSET ARITHMETIC being correct given whatever heights are known, not
    // about real measurement (which the e2e spec covers in a real browser).
    const ESTIMATED_HEIGHT_PX = 72;
    const GAP_PX = 10;

    it('stacks toasts by cumulative (estimated) height + gap, first toast at offset 0', () => {
      render(
        <ToastProvider>
          <StackComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add A'));
      fireEvent.click(screen.getByText('Add B'));
      fireEvent.click(screen.getByText('Add C'));

      const toasts = screen.getAllByTestId('toast-item');
      expect(toasts).toHaveLength(3);
      expect(toasts[0].style.getPropertyValue('--stack-offset')).toBe('0px');
      expect(toasts[1].style.getPropertyValue('--stack-offset')).toBe(`${ESTIMATED_HEIGHT_PX + GAP_PX}px`);
      expect(toasts[2].style.getPropertyValue('--stack-offset')).toBe(`${2 * (ESTIMATED_HEIGHT_PX + GAP_PX)}px`);
    });

    it('dismissing the first toast immediately recomputes the remaining toasts to fill the gap', () => {
      render(
        <ToastProvider>
          <StackComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add A'));
      fireEvent.click(screen.getByText('Add B'));
      fireEvent.click(screen.getByText('Add C'));

      const [toastA] = screen.getAllByTestId('toast-item');
      expect(toastA.style.getPropertyValue('--stack-offset')).toBe('0px');

      // Dismiss A. Unlike a real browser -- where Presence keeps a closed
      // toast mounted (fading in place) until a real animationend fires --
      // jsdom detects no actual running CSS animation and unmounts A's own
      // <li> synchronously right here (the same jsdom Presence quirk this
      // file's own "onAnimationEnd ignores an unrelated animationName"
      // test/comment already documents). So the one thing THIS test can
      // observe is what happens to the OTHER toasts, not that A itself
      // stays frozen in place while fading -- that half is real-browser-
      // only and covered by e2e/toast-stacking.spec.ts instead.
      fireEvent.click(screen.getAllByLabelText('Dismiss toast')[0]);

      const [slidB, slidC] = screen.getAllByTestId('toast-item');
      // B and C each move up by exactly one slot -- the arithmetic a real
      // browser would render as a smooth translateY transition.
      expect(slidB.style.getPropertyValue('--stack-offset')).toBe('0px');
      expect(slidC.style.getPropertyValue('--stack-offset')).toBe(`${ESTIMATED_HEIGHT_PX + GAP_PX}px`);
    });

    it('a bottom anchor stacks in reverse -- the most recently added toast sits at offset 0, closest to the screen edge', () => {
      const BottomStackComponent = () => {
        const { addToast } = useToast();
        return (
          <div>
            <button onClick={() => addToast({ id: 'a', type: 'info', message: 'Toast A' })}>Add A</button>
            <button onClick={() => addToast({ id: 'b', type: 'info', message: 'Toast B' })}>Add B</button>
            <ToastContainer />
          </div>
        );
      };
      render(
        <ToastProvider defaultAnchor="bottom-right">
          <BottomStackComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByText('Add A'));
      fireEvent.click(screen.getByText('Add B'));

      const [toastA, toastB] = screen.getAllByTestId('toast-item');
      // B was added last -- it's the one closest to the bottom edge (offset 0).
      expect(toastB.style.getPropertyValue('--stack-offset')).toBe('0px');
      // Negative -- translateY always moves DOWN in screen space
      // regardless of anchor, so stacking UP away from a bottom edge
      // requires a negative offset (Gemini-caught regression: the first
      // pass used the same positive sign as a top anchor here, which
      // would translate every toast past the first further down/off-
      // screen instead of stacking upward).
      expect(toastA.style.getPropertyValue('--stack-offset')).toBe(`-${ESTIMATED_HEIGHT_PX + GAP_PX}px`);
    });
  });
});

// Issue #632: ToastContext's value carries the live toasts array, so every
// useToast() consumer re-renders whenever any toast is added or expires.
// useToastActions() exposes just the (stable) actions from a separate,
// memoized context, so a component that only fires toasts doesn't.
describe('useToastActions (issue #632)', () => {
  it('a useToastActions() consumer does not re-render when a toast is added; a useToast() consumer does', () => {
    const actionsRendered = vi.fn();
    const fullRendered = vi.fn();
    const ActionsOnly = () => {
      actionsRendered();
      const { addToast } = useToastActions();
      return <button onClick={() => addToast({ type: 'info', message: 'fired' })}>Fire</button>;
    };
    const Full = () => {
      fullRendered();
      useToast();
      return null;
    };
    render(
      <ToastProvider>
        <ActionsOnly />
        <Full />
      </ToastProvider>
    );
    const actionsBefore = actionsRendered.mock.calls.length;
    const fullBefore = fullRendered.mock.calls.length;
    fireEvent.click(screen.getByText('Fire'));
    fireEvent.click(screen.getByText('Fire'));
    expect(actionsRendered.mock.calls.length).toBe(actionsBefore);
    expect(fullRendered.mock.calls.length).toBeGreaterThan(fullBefore);
  });

  it('returns working actions', () => {
    const Probe = () => {
      const { addToast } = useToastActions();
      return <button onClick={() => addToast({ type: 'success', message: 'Saved via actions' })}>Save</button>;
    };
    render(
      <ToastProvider>
        <Probe />
        <ToastContainer />
      </ToastProvider>
    );
    fireEvent.click(screen.getByText('Save'));
    expect(screen.getByText('Saved via actions')).toBeInTheDocument();
  });

  it('throws outside a ToastProvider', () => {
    const Probe = () => {
      useToastActions();
      return null;
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/useToastActions must be used within a ToastProvider/);
    spy.mockRestore();
  });
});
