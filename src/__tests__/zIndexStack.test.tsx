import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStackedZIndex, zIndexStackManager } from '../theme/zIndexStack';
import { Z_INDEX } from '../theme/zIndex';

// Regression coverage for the exact gap e2e/zindex-stress.spec.ts found by
// hand: every instance of a Z_INDEX tier used to default to the identical
// numeric value, so correct stacking of nested/simultaneous instances of
// the same tier depended entirely on portal/DOM append order, never a real
// guarantee. This suite verifies the manager/hook mechanics directly and
// fast, in jsdom -- the e2e spec is what proves the fix actually changes
// real, painted stacking order in a browser.
//
// zIndexStackManager is a module-level singleton, shared across every test
// in this file (Vitest isolates modules per test *file*, not per `it()`).
// Every test below unmounts everything it renders before finishing, so
// each one starts from the same net-zero registration state the previous
// one left behind -- skipping this would leak depth across tests.

describe('useStackedZIndex', () => {
  it('returns the plain tier base for a single mounted instance', () => {
    const { result, unmount } = renderHook(() => useStackedZIndex('DROPDOWN'));
    expect(result.current).toBe(Z_INDEX.DROPDOWN);
    unmount();
  });

  it('gives a second simultaneously-mounted instance of the same tier a strictly higher value', () => {
    const first = renderHook(() => useStackedZIndex('MODAL'));
    const second = renderHook(() => useStackedZIndex('MODAL'));

    expect(first.result.current).toBe(Z_INDEX.MODAL);
    expect(second.result.current).toBeGreaterThan(first.result.current);

    first.unmount();
    second.unmount();
  });

  it('lets a freed depth slot be reused after the earlier instance unmounts', () => {
    const first = renderHook(() => useStackedZIndex('MODAL'));
    const second = renderHook(() => useStackedZIndex('MODAL'));

    first.unmount();

    // With the first instance's slot freed, a third instance reuses the
    // plain tier base rather than growing depth unboundedly across a long
    // session of repeated open/close cycles.
    const third = renderHook(() => useStackedZIndex('MODAL'));
    expect(third.result.current).toBe(Z_INDEX.MODAL);

    second.unmount();
    third.unmount();
  });

  it('tracks depth independently per tier', () => {
    const modal = renderHook(() => useStackedZIndex('MODAL'));
    const dropdown = renderHook(() => useStackedZIndex('DROPDOWN'));

    expect(modal.result.current).toBe(Z_INDEX.MODAL);
    expect(dropdown.result.current).toBe(Z_INDEX.DROPDOWN);

    modal.unmount();
    dropdown.unmount();
  });

  it('assigns non-LIFO-safe depths -- closing an earlier instance out of order never collides with one still open', () => {
    // The real bug this manager originally had: tracking only an active
    // count, not which specific depth slots were occupied, let a non-LIFO
    // unmount order (open A, open B, close A, open C) hand C the same
    // depth still-open B was using.
    const a = renderHook(() => useStackedZIndex('MODAL'));
    const b = renderHook(() => useStackedZIndex('MODAL'));

    a.unmount();

    const c = renderHook(() => useStackedZIndex('MODAL'));

    expect(c.result.current).not.toBe(b.result.current);

    b.unmount();
    c.unmount();
  });

  it('the manager itself tolerates an unregister for a depth that was never registered', () => {
    // Defensive: a component tree that somehow unmounts without its own
    // registration (shouldn't happen given useLayoutEffect's cleanup
    // pairing, but the manager must not corrupt shared state for every
    // other consumer of the same tier if it ever does).
    zIndexStackManager.unregister('TOAST', 5);
    const depth = zIndexStackManager.register('TOAST');
    expect(depth).toBeGreaterThanOrEqual(0);
    zIndexStackManager.unregister('TOAST', depth);
  });
});
