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

/**
 * The union of several `MutationObserverInit`s: everything any of them asks
 * for. `MutationObserver.observe()` on an already-observed node REPLACES its
 * options, so one element watched by two hooks has to be observed once with
 * both hooks' needs; each `useMutationObserver` filters records back down to
 * its own options.
 */
export function mergeMutationOptions(all: MutationObserverInit[]): MutationObserverInit | undefined {
  if (all.length === 0) return undefined;
  // attributeFilter / attributeOldValue imply attributes, and
  // characterDataOldValue implies characterData (DOM spec).
  const wantsAttributes = (o: MutationObserverInit) => o.attributes ?? (o.attributeFilter !== undefined || o.attributeOldValue !== undefined);
  const attrUsers = all.filter(wantsAttributes);
  const merged: MutationObserverInit = {};
  if (all.some(o => o.childList)) merged.childList = true;
  if (all.some(o => o.subtree)) merged.subtree = true;
  if (all.some(o => o.characterData ?? o.characterDataOldValue !== undefined)) merged.characterData = true;
  if (all.some(o => o.characterDataOldValue)) merged.characterDataOldValue = true;
  if (attrUsers.length > 0) {
    merged.attributes = true;
    if (attrUsers.some(o => o.attributeOldValue)) merged.attributeOldValue = true;
    // Unfiltered if any user wants every attribute.
    if (attrUsers.every(o => o.attributeFilter)) {
      merged.attributeFilter = [...new Set(attrUsers.flatMap(o => o.attributeFilter ?? []))];
    }
  }
  return merged;
}

class GlobalObserverManager {
  private resizeObserver: ResizeObserver | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private resizeListener: (() => void) | null = null;

  // One entry per observe() call, not per element (#982): two hooks on the
  // same element used to share one config slot, so the second observe()
  // overwrote the first's and either hook's unobserve() stopped both.
  private trackedElements = new Map<HTMLElement, Set<ObservedElementConfig>>();
  private debounceTimers = new Map<HTMLElement, any>();
  // The mutation options each element is currently observed with, to skip
  // re-observing when they haven't changed.
  private observedMutationOptions = new Map<HTMLElement, string>();

  private registrations(element: HTMLElement): ObservedElementConfig[] {
    return [...(this.trackedElements.get(element) ?? [])];
  }

  /** The first id among `regs`, for the event's own `id` field. */
  private firstId(regs: ObservedElementConfig[]): string | undefined {
    return regs.find(r => r.id !== undefined)?.id;
  }

  constructor() {
    this.initObservers();
  }

  private initObservers() {
    if (typeof window === 'undefined') return;

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(entries => {
        entries.forEach(entry => {
          const target = entry.target as HTMLElement;
          const regs = this.registrations(target);
          if (regs.length === 0) return;

          // One event per element, at the shortest debounce any registration asked for.
          const debounceMs = Math.min(...regs.map(r => r.debounceMs ?? 50));

          if (this.debounceTimers.has(target)) {
            clearTimeout(this.debounceTimers.get(target));
          }

          const timer = setTimeout(() => {
            this.debounceTimers.delete(target);
            const { width, height } = entry.contentRect;
            const contentHeight = target.scrollHeight;

            const current = this.registrations(target);
            if (current.length === 0) return;
            aiBus.emit('element:resized', {
              id: this.firstId(current),
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
          const regs = this.registrations(target).filter(r => r.enableIntersection);
          if (regs.length === 0) return;

          aiBus.emit('element:intersected', {
            id: this.firstId(regs),
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
          // mutation actually belongs to. The walk skips a tracked element
          // with no mutationOptions (one tracked only for size, by
          // useAdaptiveSize): stopping there dropped the record, so an
          // ancestor's subtree observer never saw mutations beneath it (#981).
          let node: Node | null = mutation.target;
          let regs: ObservedElementConfig[] = [];
          while (node) {
            // A registration covers this record if it is on the target itself, or watches its subtree.
            const isTarget = node === mutation.target;
            regs = node instanceof HTMLElement ? this.registrations(node).filter(r => r.mutationOptions && (isTarget || r.mutationOptions.subtree)) : [];
            if (regs.length > 0) break;
            node = node.parentNode;
          }
          if (!node) return;

          aiBus.emit('element:mutated', {
            id: this.firstId(regs),
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

  /**
   * Adds one registration for `element` and returns a function that removes
   * that registration only. Several callers (hooks) can observe the same
   * element, each with its own config; the browser observers are driven by
   * what all of them need together, and each element emits one event per
   * change (with the first registration's `id`). A config change is a remove
   * and a fresh `observe()`, which is what a hook's effect cleanup and re-run
   * already do.
   */
  public observe(element: HTMLElement | null, config: ObservedElementConfig = {}): () => void {
    if (!element) return () => {};

    let regs = this.trackedElements.get(element);
    const firstRegistration = !regs;
    if (!regs) {
      regs = new Set();
      this.trackedElements.set(element, regs);
    }
    // A registration's identity is its own object: copy it, so a caller
    // passing the same config object twice still gets two registrations.
    const registration = { ...config };
    regs.add(registration);

    if (firstRegistration && this.resizeObserver) {
      this.resizeObserver.observe(element);
    }
    this.syncIntersectionAndMutation(element);

    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      const current = this.trackedElements.get(element);
      if (!current?.delete(registration)) return;
      if (current.size === 0) {
        this.unobserve(element);
      } else {
        this.syncIntersectionAndMutation(element);
      }
    };
  }

  /** Points the intersection and mutation observers at what `element`'s registrations currently need. */
  private syncIntersectionAndMutation(element: HTMLElement) {
    const regs = this.registrations(element);
    if (this.intersectionObserver) {
      // observe() on an already-observed target is a no-op, so this is safe to repeat.
      if (regs.some(r => r.enableIntersection)) this.intersectionObserver.observe(element);
      else this.intersectionObserver.unobserve(element);
    }
    if (this.mutationObserver) {
      const merged = mergeMutationOptions(regs.flatMap(r => (r.mutationOptions ? [r.mutationOptions] : [])));
      const key = merged ? JSON.stringify(merged) : undefined;
      // With no mutation registrations left the element stays observed (see
      // unobserve's comment): the walk in the callback finds no registration
      // that wants it and drops the record.
      if (merged && key !== this.observedMutationOptions.get(element)) {
        // Replaces this element's options with the merged set.
        this.mutationObserver.observe(element, merged);
        this.observedMutationOptions.set(element, key!);
      }
    }
  }

  /** Stops tracking `element` for every caller at once. Prefer the function `observe()` returns, which removes only its own registration. */
  public unobserve(element: HTMLElement | null) {
    if (!element) return;

    if (this.debounceTimers.has(element)) {
      clearTimeout(this.debounceTimers.get(element));
      this.debounceTimers.delete(element);
    }

    if (this.trackedElements.has(element)) {
      this.trackedElements.delete(element);
      this.observedMutationOptions.delete(element);

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
