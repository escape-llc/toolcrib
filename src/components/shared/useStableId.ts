import { useId } from 'react';

/**
 * Generates a stable id once for the component's lifetime: `propId` if the
 * caller passed one, otherwise a `prefix-<reactId>` id.
 *
 * Backed by React's own `useId()`, not `Math.random()` behind a `useRef`
 * (the previous implementation). `Math.random()` produces a different value
 * on the server than on the client's first render — harmless for purely
 * client-rendered apps, but for anyone server-rendering (Next.js, Remix,
 * any SSR framework), React hydration compares the server-rendered markup
 * against the client's first render and errors/warns on any mismatch. That
 * only bites `<Splitter>` directly, since it's the only caller that renders
 * its id into a DOM attribute (`data-ai-layout-domain`) — but fixing the
 * shared primitive fixes it everywhere at once and forecloses the same bug
 * for any future consumer that does render its id, not just the ones that
 * happen not to today.
 *
 * `useId()` is already guaranteed stable across re-renders for a given
 * component instance (that's its whole contract), so this no longer needs
 * `useRef` at all — the previous `useRef` existed only to stop
 * `Math.random()` from being called again on every render; `useId()` has no
 * such per-render cost to begin with.
 */
export function useStableId(propId: string | undefined, prefix: string): string {
  const reactId = useId();
  return propId || `${prefix}-${reactId}`;
}
