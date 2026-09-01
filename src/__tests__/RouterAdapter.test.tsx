import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { RouterAdapterProvider, useRouterBridge, type RouterAdapter } from '../components/RouterAdapter/RouterAdapterContext';
import { aiBus } from '../eventBus/eventBus';

describe('useRouterBridge', () => {
  it('forwards aiBus.navigate() to the provided adapter', () => {
    const navigate = vi.fn();
    const adapter: RouterAdapter = { navigate };

    renderHook(() => useRouterBridge(), {
      wrapper: ({ children }) => <RouterAdapterProvider adapter={adapter}>{children}</RouterAdapterProvider>,
    });

    act(() => {
      aiBus.navigate('/settings');
    });

    expect(navigate).toHaveBeenCalledWith('/settings');
  });

  it('forwards a direct aiBus.emit("route:navigate", ...) call, not just the convenience method', () => {
    const navigate = vi.fn();
    const adapter: RouterAdapter = { navigate };

    renderHook(() => useRouterBridge(), {
      wrapper: ({ children }) => <RouterAdapterProvider adapter={adapter}>{children}</RouterAdapterProvider>,
    });

    act(() => {
      aiBus.emit('route:navigate', { to: '/direct-emit' });
    });

    expect(navigate).toHaveBeenCalledWith('/direct-emit');
  });

  it('does not throw when mounted with no RouterAdapterProvider above it, and a subsequent navigate is a safe no-op', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useRouterBridge());
    }).not.toThrow();

    expect(() => {
      act(() => {
        aiBus.navigate('/nowhere');
      });
    }).not.toThrow();

    warnSpy.mockRestore();
  });

  it('warns via console.warn (dev-mode) only when a navigation is actually attempted with no adapter mounted, not on mount', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    renderHook(() => useRouterBridge());
    expect(warnSpy).not.toHaveBeenCalled();

    act(() => {
      aiBus.navigate('/nowhere');
    });

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('RouterAdapterProvider'));
    warnSpy.mockRestore();
  });

  // Regression guard: 'route:navigate' sits one line away from
  // STICKY_EVENTS in eventBus.ts — a future accidental addition there
  // should fail this test immediately. Sticky replay is for state a late
  // subscriber needs to catch up on (tab:changed's current tab); a
  // navigation command must never be replayed to a subscriber that mounts
  // after it already fired.
  it('does NOT replay a route:navigate emitted before the bridge mounted (not sticky)', () => {
    act(() => {
      aiBus.navigate('/before-mount');
    });

    const navigate = vi.fn();
    const adapter: RouterAdapter = { navigate };
    renderHook(() => useRouterBridge(), {
      wrapper: ({ children }) => <RouterAdapterProvider adapter={adapter}>{children}</RouterAdapterProvider>,
    });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('unsubscribes on unmount — a navigate() after unmount does not call the old adapter', () => {
    const navigate = vi.fn();
    const adapter: RouterAdapter = { navigate };

    const { unmount } = renderHook(() => useRouterBridge(), {
      wrapper: ({ children }) => <RouterAdapterProvider adapter={adapter}>{children}</RouterAdapterProvider>,
    });
    unmount();

    act(() => {
      aiBus.navigate('/after-unmount');
    });

    expect(navigate).not.toHaveBeenCalled();
  });
});
