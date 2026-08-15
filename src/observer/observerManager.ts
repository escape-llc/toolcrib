import { aiBus } from '../eventBus/eventBus';

/** @barrelExport */
export interface ObservedElementConfig {
  id?: string;
  debounceMs?: number;
  enableIntersection?: boolean;
}

class GlobalObserverManager {
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
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
    }
  }
}

export const observerManager = new GlobalObserverManager();
