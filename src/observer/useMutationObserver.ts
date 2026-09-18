'use client';

import { useEffect, type RefObject } from 'react';
import { observerManager } from './observerManager';
import { useAIEvent } from '../eventBus/useAIEvent';
import { type AIEventMap } from '../eventBus/eventBus';

/** @barrelExport */
export interface UseMutationObserverConfig {
  /** Optional identifier surfaced on the `element:mutated` event's own `id` field -- purely for a consumer's own debugging/disambiguation, not the actual event-routing mechanism (that's done by comparing `event.target` against `ref.current`/its descendants, the same way `useAdaptiveSize` already routes `element:resized`/`element:intersected`). */
  id?: string;
  /**
   * Skips subscribing entirely while `false` -- a hook itself can't be
   * called conditionally (Rules of Hooks), so a caller that only cares
   * about mutations in some states (e.g. `useActualPopoverSide`'s own
   * `isOpen`) still calls this hook every render and toggles this flag
   * instead of wrapping the call itself in an `if`.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Subscribes `ref`'s element to the centralized `MutationObserver` behind
 * `observerManager` (issue #515) -- the same "one shared instance, many
 * observed elements" shape `useAdaptiveSize` already establishes for
 * `ResizeObserver`/`IntersectionObserver`, closing the one real, pre-
 * existing gap: `connectedPopoverStyles.ts`'s `useActualPopoverSide` used
 * to create its own dedicated `MutationObserver` per component instance.
 *
 * `mutationOptions` should be a stable reference across renders (a
 * module-level constant, or memoized) where practical -- it's compared
 * via `JSON.stringify` in this hook's own effect dependency (every field
 * `MutationObserverInit` declares is a plain boolean/string/string-array,
 * always JSON-serializable, so this is safe, if a little unusual) rather
 * than asking every caller to memoize it themselves; a literal object
 * passed fresh each render still works correctly, just re-subscribes
 * (a real but cheap `MutationObserver.observe()` call, not a leak) if
 * and only if its serialized shape actually changed.
 *
 * Mirrors `useAdaptiveSize`'s own bounded `requestAnimationFrame` retry
 * for a `ref.current` that's still null on this effect's first run (a
 * real, confirmed case: Radix `Presence`-mounted content, e.g. a Popover
 * `Content`, can land one render tick after its own `isOpen` flips true)
 * -- see that hook's own comment for the full reasoning; this is not a
 * new precaution invented for this hook.
 */
export function useMutationObserver(
  ref: RefObject<HTMLElement | null>,
  mutationOptions: MutationObserverInit,
  onMutation: (event: AIEventMap['element:mutated']) => void,
  config: UseMutationObserverConfig = {}
): void {
  const enabled = config.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let rafId: number | null = null;
    let attempts = 0;
    let observedEl: HTMLElement | null = null;
    const MAX_ATTACH_RETRY_FRAMES = 10;

    const trySetup = () => {
      if (cancelled) return;
      const el = ref.current;
      if (!el) {
        if (attempts++ < MAX_ATTACH_RETRY_FRAMES) {
          rafId = requestAnimationFrame(trySetup);
        }
        return;
      }
      observerManager.observe(el, { id: config.id, mutationOptions });
      observedEl = el;
    };

    trySetup();

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (observedEl) observerManager.unobserve(observedEl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, config.id, enabled, JSON.stringify(mutationOptions)]);

  useAIEvent('element:mutated', event => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    // `event.target` can be a DESCENDANT of `el` (see this hook's own
    // `mutationOptions.subtree` and `element:mutated`'s own doc comment
    // in eventBus.ts) -- `contains()` covers both "is el itself" and
    // "is somewhere inside el" in one call.
    if (el === event.target || el.contains(event.target as Node)) {
      onMutation(event);
    }
  });
}
