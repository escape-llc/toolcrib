'use client';

import { aiBus } from '../eventBus/eventBus';

/** @barrelExport */
export interface ObservedElementConfig {
  id?: string;
  debounceMs?: number;
  enableIntersection?: boolean;
  /**
   * Opts an element into centralized `MutationObserver` tracking (issue
   * #515) -- one shared `MutationObserver` instance covers every
   * observed element, the same "one shared instance per observer type"
   * shape `resizeObserver`/`intersectionObserver` already establish,
   * rather than a consumer creating its own dedicated instance (the
   * pattern this ticket found and closed: `connectedPopoverStyles.ts`'s
   * `useActualPopoverSide` was the one real, pre-existing ad hoc case).
   * Passed straight through to the real `MutationObserver.observe()`
   * call, unmodified.
   */
  mutationOptions?: MutationObserverInit;
}

class GlobalObserverManager {
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private resizeListener: (() => void) | null = null;

  private trackedElements = new Map<HTMLElement, ObservedElementConfig>();
  private debounceTimers = new Map<HTMLElement, any>();

  constructor() {
    this.initObservers();
  }

  private initObservers() {
    if (typeof window === 'undefined') return;

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(entries => {
        entries.forEach(entry => {
          const target = entry.target as HTMLElement;
          const config = this.trackedElements.get(target);
          if (!config) return;

          const debounceMs = config.debounceMs ?? 50;

          if (this.debounceTimers.has(target)) {
            clearTimeout(this.debounceTimers.get(target));
          }

          const timer = setTimeout(() => {
            this.debounceTimers.delete(target);
            const { width, height } = entry.contentRect;
            const contentHeight = target.scrollHeight;

            aiBus.emit('element:resized', {
              id: config.id,
              target,
              width,
              height,
              contentHeight,
            });
          }, debounceMs);

          this.debounceTimers.set(target, timer);
        });
      });
    }

    if (typeof IntersectionObserver !== 'undefined') {
      this.intersectionObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          const target = entry.target as HTMLElement;
          const config = this.trackedElements.get(target);
          if (!config || !config.enableIntersection) return;

          aiBus.emit('element:intersected', {
            id: config.id,
            target,
            isIntersecting: entry.isIntersecting,
            ratio: entry.intersectionRatio,
          });
        });
      });
    }

    if (typeof MutationObserver !== 'undefined') {
      this.mutationObserver = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          // `subtree: true` (the one real motivating use case, issue
          // #515, needs it) means `mutation.target` can be a DESCENDANT
          // of whichever element `observe()` was actually called on, not
          // that element itself -- unlike the resize/intersection
          // entries above, which always report the literal observed
          // element. Walk up from the real mutation target to find which
          // tracked root element (and therefore which config/id) this
          // mutation actually belongs to.
          let node: Node | null = mutation.target;
          while (node && !(node instanceof HTMLElement && this.trackedElements.has(node))) {
            node = node.parentNode;
          }
          if (!node) return;
          const config = this.trackedElements.get(node as HTMLElement);
          if (!config || !config.mutationOptions) return;

          aiBus.emit('element:mutated', {
            id: config.id,
            target: mutation.target,
            type: mutation.type,
            attributeName: mutation.attributeName,
            oldValue: mutation.oldValue,
          });
        });
      });
    }

    // Global viewport resize listener
    let windowTimer: any = null;
    this.resizeListener = () => {
      if (windowTimer) clearTimeout(windowTimer);
      windowTimer = setTimeout(() => {
        aiBus.emit('viewport:resized', {
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 100);
    };
    window.addEventListener('resize', this.resizeListener);
  }

  /**
   * Detaches the global `resize` listener. The manager is a module-level
   * singleton, so nothing calls this in normal app lifetime — it exists for
   * HMR/test teardown, where the module (and this listener) would otherwise
   * be re-created on `window` without ever removing the previous instance's.
   */
  public destroy() {
    if (typeof window === 'undefined' || !this.resizeListener) return;
    window.removeEventListener('resize', this.resizeListener);
    this.resizeListener = null;
  }

  public observe(element: HTMLElement | null, config: ObservedElementConfig = {}) {
    if (!element) return;

    const alreadyTracked = this.trackedElements.has(element);
    // Always store the latest config, even for an already-tracked element —
    // previously a second observe() call on the same element (e.g. a hook's
    // effect re-running with a changed config.id/enableIntersection while
    // the DOM node stays mounted) silently kept the first call's config
    // forever, so resize events kept reporting stale data.
    this.trackedElements.set(element, config);

    if (!alreadyTracked && this.resizeObserver) {
      this.resizeObserver.observe(element);
    }

    if (config.enableIntersection && this.intersectionObserver) {
      this.intersectionObserver.observe(element);
    }

    if (config.mutationOptions && this.mutationObserver) {
      this.mutationObserver.observe(element, config.mutationOptions);
    }
  }

  public unobserve(element: HTMLElement | null) {
    if (!element) return;

    if (this.debounceTimers.has(element)) {
      clearTimeout(this.debounceTimers.get(element));
      this.debounceTimers.delete(element);
    }

    if (this.trackedElements.has(element)) {
      this.trackedElements.delete(element);

      if (this.resizeObserver) {
        this.resizeObserver.unobserve(element);
      }
      if (this.intersectionObserver) {
        this.intersectionObserver.unobserve(element);
      }
      // No equivalent `mutationObserver.unobserve(element)` call --
      // MutationObserver's own API doesn't have one; `.disconnect()` is
      // the only stop method it exposes, and it's all-or-nothing (stops
      // every observed target on that instance, not just this one), so
      // calling it here would silently break every OTHER element still
      // being tracked. This is a real, documented MutationObserver API
      // limitation, not an oversight -- deleting this element from
      // `trackedElements` just above is what actually stops it from this
      // manager's own perspective: the mutation callback above looks up
      // the tracked config for every incoming record and silently drops
      // anything it can't find, so mutations for an untracked element's
      // subtree keep arriving at the browser level (a harmless, bounded
      // cost -- the node is typically about to be garbage-collected once
      // unmounted anyway) but are never emitted on the bus.
    }
  }
}

export const observerManager = new GlobalObserverManager();
