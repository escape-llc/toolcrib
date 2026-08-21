import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScrollOverflow } from '../components/shared/useScrollOverflow';

function makeMockContainer(overrides: Partial<{ scrollLeft: number; scrollWidth: number; clientWidth: number }> = {}) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  Object.defineProperty(el, 'scrollLeft', { value: overrides.scrollLeft ?? 0, configurable: true });
  Object.defineProperty(el, 'scrollWidth', { value: overrides.scrollWidth ?? 100, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: overrides.clientWidth ?? 100, configurable: true });
  el.scrollBy = vi.fn();
  return el;
}

describe('useScrollOverflow', () => {
  it('reports no overflow for a container whose content fits entirely', () => {
    const el = makeMockContainer({ scrollLeft: 0, scrollWidth: 100, clientWidth: 100 });
    const ref = { current: el };
    const { result } = renderHook(() => useScrollOverflow(ref));

    expect(result.current.canScrollLeft).toBe(false);
    expect(result.current.canScrollRight).toBe(false);
  });

  it('reports canScrollRight when there is hidden content past the visible edge, and canScrollLeft once scrolled away from the start', () => {
    const el = makeMockContainer({ scrollLeft: 0, scrollWidth: 400, clientWidth: 100 });
    const ref = { current: el };
    const { result } = renderHook(() => useScrollOverflow(ref));

    expect(result.current.canScrollRight).toBe(true);
    expect(result.current.canScrollLeft).toBe(false);

    // Scroll away from the start — re-check happens via the container's own
    // native 'scroll' event listener.
    Object.defineProperty(el, 'scrollLeft', { value: 50, configurable: true });
    act(() => {
      el.dispatchEvent(new Event('scroll'));
    });

    expect(result.current.canScrollLeft).toBe(true);
  });

  it('scrollBy delegates to the container element\'s own scrollBy', () => {
    const el = makeMockContainer();
    const ref = { current: el };
    const { result } = renderHook(() => useScrollOverflow(ref));

    result.current.scrollBy(180);
    expect(el.scrollBy).toHaveBeenCalledWith({ left: 180, behavior: 'smooth' });
  });

  it('does nothing when the ref has no current element yet', () => {
    const ref = { current: null };
    expect(() => renderHook(() => useScrollOverflow(ref))).not.toThrow();
  });
});
