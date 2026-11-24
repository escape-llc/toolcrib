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
 * real, confirmed case: `Presence`-mounted content, e.g. a Popover
 * popup, can land one render tick after its own `isOpen` flips true)
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
    let stopObserving: (() => void) | null = null;
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
      stopObserving = observerManager.observe(el, { id: config.id, mutationOptions });
    };

    trySetup();

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      // Removes only this hook's registration; another hook on the same element keeps its own (#982).
      stopObserving?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, config.id, enabled, JSON.stringify(mutationOptions)]);

  useAIEvent('element:mutated', event => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    // `element:mutated` is one global channel, fed by every element any
    // hook observes, so a record can reach this listener that this hook's
    // own options would never have produced: a child observed by another
    // component, or a different mutation type (#981). Accept it only if
    // `mutationOptions` asks for it.
    if (matchesMutationOptions(el, event, mutationOptions)) {
      onMutation(event);
    }
  });
}

/**
 * Whether `MutationObserver.observe(el, options)` would itself have reported
 * `event`: a descendant target only with `subtree`, and only the mutation
 * types (and attribute names) the options enable.
 */
function matchesMutationOptions(el: HTMLElement, event: AIEventMap['element:mutated'], options: MutationObserverInit): boolean {
  const target = event.target as Node;
  if (target !== el && !(options.subtree && el.contains(target))) return false;
  switch (event.type) {
    case 'attributes': {
      // Per the DOM spec, attributeFilter or attributeOldValue implies attributes: true.
      const enabled = options.attributes ?? (options.attributeFilter !== undefined || options.attributeOldValue !== undefined);
      if (!enabled) return false;
      return !options.attributeFilter || (event.attributeName !== null && options.attributeFilter.includes(event.attributeName));
    }
    case 'characterData':
      return options.characterData ?? options.characterDataOldValue !== undefined;
    case 'childList':
      return !!options.childList;
    default:
      return false;
  }
}
