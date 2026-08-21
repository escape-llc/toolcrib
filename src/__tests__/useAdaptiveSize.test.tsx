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
});
