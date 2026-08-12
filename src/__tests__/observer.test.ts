import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { observerManager } from '../observer/observerManager';
import { aiBus } from '../eventBus/eventBus';

describe('GlobalObserverManager & Adaptive Sizing Engine', () => {
  it('registers elements with observerManager without crashing', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    expect(() => observerManager.observe(div)).not.toThrow();
    expect(() => observerManager.unobserve(div)).not.toThrow();

    document.body.removeChild(div);
  });

  it('dispatches element:resized events on aiBus', async () => {
    const listener = vi.fn();
    const unsubscribe = aiBus.on('element:resized', listener);

    const targetDiv = document.createElement('div');
    aiBus.emit('element:resized', {
      id: 'test-el',
      target: targetDiv,
      width: 500,
      height: 400,
      contentHeight: 1200,
    });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-el',
        width: 500,
        height: 400,
        contentHeight: 1200,
      })
    );

    unsubscribe();
  });
});

/**
 * jsdom implements neither ResizeObserver nor IntersectionObserver, so
 * `observerManager`'s own `if (typeof ResizeObserver !== 'undefined')`
 * guards are always false above — the block above proves aiBus.emit()
 * itself works, not that observerManager's callback wiring (config
 * lookup by element, debounce, enableIntersection gating, id-tagging)
 * is correct. This block installs minimal controllable mocks *before*
 * observerManager is (re-)imported via `vi.resetModules()`, so its
 * singleton constructor sees them and actually constructs real
 * ResizeObserver/IntersectionObserver instances — then drives their
 * captured callbacks directly with synthetic entries to exercise the
 * real internal logic, plus the module-level `window` 'resize' listener
 * that powers `viewport:resized`.
 */
describe('GlobalObserverManager real callback wiring (mocked observers)', () => {
  let capturedResize: { callback: (entries: any[]) => void } | null = null;
  let capturedIntersection: { callback: (entries: any[]) => void } | null = null;
  let freshObserverManager: typeof observerManager;
  let freshAiBus: typeof aiBus;

  beforeAll(async () => {
    class MockResizeObserver {
      callback: (entries: any[]) => void;
      constructor(callback: (entries: any[]) => void) {
        this.callback = callback;
        capturedResize = this;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    class MockIntersectionObserver {
      callback: (entries: any[]) => void;
      constructor(callback: (entries: any[]) => void) {
        this.callback = callback;
        capturedIntersection = this;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    (globalThis as any).ResizeObserver = MockResizeObserver;
    (globalThis as any).IntersectionObserver = MockIntersectionObserver;

    vi.resetModules();
    ({ observerManager: freshObserverManager } = await import('../observer/observerManager'));
    ({ aiBus: freshAiBus } = await import('../eventBus/eventBus'));
  });

  afterAll(() => {
    delete (globalThis as any).ResizeObserver;
    delete (globalThis as any).IntersectionObserver;
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits element:resized with the tracked id after the debounce window', () => {
    const el = document.createElement('div');
    const spy = vi.fn();
    freshAiBus.on('element:resized', spy);

    freshObserverManager.observe(el, { id: 'panel-1', debounceMs: 20 });
    expect(capturedResize).not.toBeNull();

    capturedResize!.callback([{ target: el, contentRect: { width: 300, height: 150 } }]);
    expect(spy).not.toHaveBeenCalled(); // still debouncing

    vi.advanceTimersByTime(20);
    expect(spy).toHaveBeenCalledWith({
      id: 'panel-1',
      target: el,
      width: 300,
      height: 150,
      contentHeight: el.scrollHeight,
    });
  });

  it('ignores resize entries for elements it never observed', () => {
    const untracked = document.createElement('div');
    const spy = vi.fn();
    freshAiBus.on('element:resized', spy);

    capturedResize!.callback([{ target: untracked, contentRect: { width: 10, height: 10 } }]);
    vi.advanceTimersByTime(100);

    expect(spy).not.toHaveBeenCalled();
  });

  it('only emits element:intersected for elements observed with enableIntersection', () => {
    const watched = document.createElement('div');
    const unwatched = document.createElement('div');
    const spy = vi.fn();
    freshAiBus.on('element:intersected', spy);

    freshObserverManager.observe(watched, { id: 'watched', enableIntersection: true });
    freshObserverManager.observe(unwatched, { id: 'unwatched' });

    capturedIntersection!.callback([
      { target: watched, isIntersecting: true, intersectionRatio: 0.6 },
      { target: unwatched, isIntersecting: true, intersectionRatio: 1 },
    ]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ id: 'watched', target: watched, isIntersecting: true, ratio: 0.6 });
  });

  it('stops emitting for an element after unobserve', () => {
    const el = document.createElement('div');
    const spy = vi.fn();
    freshAiBus.on('element:resized', spy);

    freshObserverManager.observe(el, { id: 'temp', debounceMs: 10 });
    freshObserverManager.unobserve(el);

    capturedResize!.callback([{ target: el, contentRect: { width: 1, height: 1 } }]);
    vi.advanceTimersByTime(50);

    expect(spy).not.toHaveBeenCalled();
  });

  it('emits viewport:resized on window resize, debounced', () => {
    const spy = vi.fn();
    freshAiBus.on('viewport:resized', spy);

    window.dispatchEvent(new Event('resize'));
    expect(spy).not.toHaveBeenCalled(); // still debouncing

    vi.advanceTimersByTime(100);
    expect(spy).toHaveBeenCalledWith({ width: window.innerWidth, height: window.innerHeight });
  });
});
