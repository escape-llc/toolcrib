import { useRef } from 'react';

/**
 * Generates a stable id once for the component's lifetime: `propId` if the
 * caller passed one, otherwise a random `prefix-xxxxx` id.
 *
 * Backed by `useRef`, not a default parameter (`id = propId || randomId()`)
 * or `useMemo` — both of those re-evaluate on every render they aren't
 * explicitly skipped for, silently reshuffling the id on some unrelated
 * re-render and breaking event-bus targeting for any caller that captured
 * it after the first render. `useRef`'s initial value is only ever used on
 * mount, so the id can't change no matter what else causes a re-render.
 *
 * Shared by every overlay/menu component that needs an id for event-bus
 * targeting (`Modal`, `Popup`, `SlideOut`, `DropdownMenu`, `Accordion`) —
 * each used to carry its own copy of this exact pattern.
 */
export function useStableId(propId: string | undefined, prefix: string): string {
  const idRef = useRef<string>(propId || `${prefix}-${Math.random().toString(36).substring(2, 7)}`);
  return idRef.current;
}
