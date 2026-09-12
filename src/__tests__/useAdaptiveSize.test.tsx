import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAdaptiveSize } from '../observer/useAdaptiveSize';
import { aiBus } from '../eventBus/eventBus';

function renderWithRealElement() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const ref = { current: el };
  const hook = renderHook(() => useAdaptiveSize(ref));
  return { ...hook, ref };
}

describe('useAdaptiveSize', () => {
  it('applies an element:resized event targeting its own ref, updating width/height/contentHeight', () => {
    const { result, ref } = renderWithRealElement();

    act(() => {
      aiBus.emit('element:resized', { target: ref.current, width: 320, height: 240, contentHeight: 480 });
    });

    expect(result.current.width).toBe(320);
    expect(result.current.height).toBe(240);
    expect(result.current.contentHeight).toBe(480);
  });

  it('ignores an element:resized event targeting a different element', () => {
    const { result } = renderWithRealElement();
    const otherEl = document.createElement('div');

    act(() => {
      aiBus.emit('element:resized', { target: otherEl, width: 999, height: 999, contentHeight: 999 });
    });

    expect(result.current.width).not.toBe(999);
  });

  it('applies an element:intersected event targeting its own ref, updating isIntersecting', () => {
    const { result, ref } = renderWithRealElement();
    expect(result.current.isIntersecting).toBe(true);

    act(() => {
      aiBus.emit('element:intersected', { target: ref.current, isIntersecting: false, ratio: 0 });
    });

    expect(result.current.isIntersecting).toBe(false);
  });

  it('ignores an element:intersected event targeting a different element', () => {
    const { result } = renderWithRealElement();
    const otherEl = document.createElement('div');

    act(() => {
      aiBus.emit('element:intersected', { target: otherEl, isIntersecting: false, ratio: 0 });
    });

    expect(result.current.isIntersecting).toBe(true);
  });

  it('does nothing when the ref has no current element yet', () => {
    const ref = { current: null };
    expect(() => renderHook(() => useAdaptiveSize(ref))).not.toThrow();
  });

  // Regression found building <Toast>'s stacking positions: a ref rendered
  // through a React portal (Radix's ToastPrimitive.Root, portaled into a
  // Viewport that's itself still being set up in the same commit) could
  // still be null on this hook's very first effect run. The original
  // implementation gave up permanently at that point -- nothing else would
  // ever re-run the effect once the ref DID attach, since mutating a ref's
  // .current never triggers a re-render. Confirmed for real in a browser
  // (e2e/toast-stacking.spec.ts): the first toast ever mounted never got
  // its height measured at all, so every OTHER toast's stacking math kept
  // computing off a stale fallback estimate for it forever.
  it('retries via requestAnimationFrame if the ref is not attached on the first effect run, then measures once it is', async () => {
    const ref: { current: HTMLElement | null } = { current: null };
    const { result } = renderHook(() => useAdaptiveSize(ref));
    expect(result.current.height).toBe(0);

    const el = document.createElement('div');
    document.body.appendChild(el);
    el.getBoundingClientRect = () => ({
      top: 0, left: 0, right: 100, bottom: 50, width: 100, height: 50, x: 0, y: 0, toJSON: () => {},
    });
    // Simulates the ref attaching one tick after this hook's own mount
    // effect already ran and found it null -- exactly the portal-timing
    // gap this fix closes.
    ref.current = el;

    await act(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });

    expect(result.current.width).toBe(100);
    expect(result.current.height).toBe(50);
  });
});
