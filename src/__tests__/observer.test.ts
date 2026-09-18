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

/**
 * Unlike ResizeObserver/IntersectionObserver (neither implemented by
 * jsdom, hence the mocked-class suite above), jsdom DOES implement a
 * real MutationObserver -- confirmed directly, not assumed. So this
 * suite drives observerManager's mutation wiring (issue #515) against
 * the real thing: real DOM attribute changes, a real (module-singleton)
 * observerManager instance, real microtask-queued MutationObserver
 * callbacks (awaited via a resolved microtask flush, not a fixed
 * timeout -- MutationObserver callbacks are always async, but the
 * browser/jsdom's own scheduling of them has no fixed delay to wait a
 * specific duration for).
 */
describe('GlobalObserverManager MutationObserver wiring (real jsdom MutationObserver)', () => {
  const flushMicrotasks = () => new Promise(resolve => queueMicrotask(() => resolve(undefined)));

  it('emits element:mutated for an attribute change on an observed element', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const spy = vi.fn();
    const unsubscribe = aiBus.on('element:mutated', spy);

    observerManager.observe(el, { id: 'mut-1', mutationOptions: { attributes: true, attributeFilter: ['data-side'] } });
    el.setAttribute('data-side', 'top');
    await flushMicrotasks();

    expect(spy).toHaveBeenCalledWith({
      id: 'mut-1',
      target: el,
      type: 'attributes',
      attributeName: 'data-side',
      oldValue: null,
    });

    unsubscribe();
    observerManager.unobserve(el);
    document.body.removeChild(el);
  });

  it('attributes a subtree mutation to the tracked ANCESTOR element, not the descendant that actually changed', async () => {
    const root = document.createElement('div');
    const child = document.createElement('span');
    root.appendChild(child);
    document.body.appendChild(root);
    const spy = vi.fn();
    const unsubscribe = aiBus.on('element:mutated', spy);

    // subtree: true, observed on `root` -- Radix's own real shape this
    // was built for (the attribute lands on a descendant of whichever
    // node a caller's ref points to, not necessarily that node itself).
    observerManager.observe(root, { id: 'mut-subtree', mutationOptions: { attributes: true, attributeFilter: ['data-side'], subtree: true } });
    child.setAttribute('data-side', 'bottom');
    await flushMicrotasks();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'mut-subtree', target: child, attributeName: 'data-side' })
    );

    unsubscribe();
    observerManager.unobserve(root);
    document.body.removeChild(root);
  });

  it('does not emit element:mutated for an element observed without mutationOptions', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const spy = vi.fn();
    const unsubscribe = aiBus.on('element:mutated', spy);

    observerManager.observe(el, { id: 'no-mutation-opts' });
    el.setAttribute('data-side', 'left');
    await flushMicrotasks();

    expect(spy).not.toHaveBeenCalled();

    unsubscribe();
    observerManager.unobserve(el);
    document.body.removeChild(el);
  });

  it('stops emitting element:mutated for an element after unobserve, without affecting other still-tracked elements', async () => {
    // Regression for the one real API asymmetry this feature has to
    // handle: MutationObserver has no per-element `.unobserve()` --
    // `.disconnect()` is all-or-nothing. observerManager's own fix is to
    // keep the browser-level observation running but silently drop
    // anything for an element no longer in `trackedElements` -- this
    // confirms that actually holds, and that it doesn't collaterally
    // break a DIFFERENT element still being tracked on the same shared
    // MutationObserver instance.
    const stillTracked = document.createElement('div');
    const removed = document.createElement('div');
    document.body.appendChild(stillTracked);
    document.body.appendChild(removed);
    const spy = vi.fn();
    const unsubscribe = aiBus.on('element:mutated', spy);

    observerManager.observe(stillTracked, { id: 'still-tracked', mutationOptions: { attributes: true, attributeFilter: ['data-side'] } });
    observerManager.observe(removed, { id: 'removed', mutationOptions: { attributes: true, attributeFilter: ['data-side'] } });
    observerManager.unobserve(removed);

    removed.setAttribute('data-side', 'top');
    stillTracked.setAttribute('data-side', 'bottom');
    await flushMicrotasks();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ id: 'still-tracked', target: stillTracked }));

    unsubscribe();
    observerManager.unobserve(stillTracked);
    document.body.removeChild(stillTracked);
    document.body.removeChild(removed);
  });
});
