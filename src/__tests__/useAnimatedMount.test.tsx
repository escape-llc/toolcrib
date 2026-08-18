import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimatedMount } from '../theme/useAnimatedMount';

describe('useAnimatedMount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts immediately when isOpen starts true, with no closing phase', () => {
    const { result } = renderHook(() => useAnimatedMount(true));
    expect(result.current.isMounted).toBe(true);
    expect(result.current.isClosing).toBe(false);
  });

  it('stays unmounted while isOpen is false', () => {
    const { result } = renderHook(() => useAnimatedMount(false));
    expect(result.current.isMounted).toBe(false);
    expect(result.current.isClosing).toBe(false);
  });

  it('enters the closing phase (still mounted) when isOpen flips to false, then unmounts once finalizeClose is called', () => {
    const { result, rerender } = renderHook(({ isOpen }) => useAnimatedMount(isOpen), {
      initialProps: { isOpen: true },
    });
    expect(result.current.isMounted).toBe(true);

    rerender({ isOpen: false });
    // Regression: the component must stay mounted through the closing
    // phase — this is the entire point of the hook (see its own doc
    // comment on the Toast/Drawer bugs an immediate unmount caused).
    expect(result.current.isMounted).toBe(true);
    expect(result.current.isClosing).toBe(true);

    act(() => {
      result.current.finalizeClose();
    });
    expect(result.current.isMounted).toBe(false);
    expect(result.current.isClosing).toBe(false);
  });

  it('finalizes automatically via the backstop timer if finalizeClose is never called (e.g. no matching animationend)', () => {
    const { result, rerender } = renderHook(({ isOpen }) => useAnimatedMount(isOpen, 600), {
      initialProps: { isOpen: true },
    });
    rerender({ isOpen: false });
    expect(result.current.isMounted).toBe(true);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.isMounted).toBe(false);
  });

  it('a real finalizeClose call preempts the backstop timer without double-firing', () => {
    const { result, rerender } = renderHook(({ isOpen }) => useAnimatedMount(isOpen, 600), {
      initialProps: { isOpen: true },
    });
    rerender({ isOpen: false });

    act(() => {
      result.current.finalizeClose();
    });
    expect(result.current.isMounted).toBe(false);

    // The backstop timer is still pending — advancing past it must not
    // throw or otherwise misbehave now that finalize already ran once.
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.isMounted).toBe(false);
  });

  it('re-opening after a close resets the closing phase for the next cycle', () => {
    const { result, rerender } = renderHook(({ isOpen }) => useAnimatedMount(isOpen, 600), {
      initialProps: { isOpen: true },
    });
    rerender({ isOpen: false });
    act(() => {
      result.current.finalizeClose();
    });
    expect(result.current.isMounted).toBe(false);

    rerender({ isOpen: true });
    expect(result.current.isMounted).toBe(true);
    expect(result.current.isClosing).toBe(false);

    rerender({ isOpen: false });
    expect(result.current.isMounted).toBe(true);
    expect(result.current.isClosing).toBe(true);
    act(() => {
      result.current.finalizeClose();
    });
    expect(result.current.isMounted).toBe(false);
  });
});
