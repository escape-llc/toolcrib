'use client';

import React, { useLayoutEffect, useRef, useState, type ReactElement, type Ref } from 'react';

/**
 * Keeps `children` mounted while `present` is false for as long as the
 * child element's own exit animation runs, then unmounts it (#703:
 * toolcrib's own, replacing `@radix-ui/react-presence`, the last Radix
 * import; the Base UI parts do this themselves). The exit animation is
 * whatever the child's style applies once `present` flips false (e.g.
 * `animation: ai-fade-out ...`). With nothing running on the element --
 * reduced motion, no exit animation, jsdom -- it unmounts in the same
 * commit, so nothing lingers.
 *
 * `children` must be one element that renders a DOM node and accepts a
 * ref (a plain `<div>`), with no ref of its own: Presence sets it.
 */
export function Presence({ present, children }: { present: boolean; children: ReactElement }): ReactElement | null {
  const [mounted, setMounted] = useState(present);
  const nodeRef = useRef<HTMLElement | null>(null);

  // Mount immediately when present turns on (adjusting state during render,
  // not an effect, so the child appears in the same commit).
  if (present && !mounted) setMounted(true);

  useLayoutEffect(() => {
    if (present || !mounted) return;
    const node = nodeRef.current;
    // Read after this commit applied the child's exit style, so a newly
    // started exit animation is already in the list.
    const animations = node && typeof node.getAnimations === 'function' ? node.getAnimations() : [];
    if (animations.length === 0) {
      // Nothing to wait for: unmount in this same commit rather than a
      // microtask later, so a test's act() or a reduced-motion user never
      // sees a stale frame. Syncing to the DOM's animation state is the
      // effect's whole purpose.
      setMounted(false);
      return;
    }
    let cancelled = false;
    // finished rejects when an animation is cancelled (e.g. the node's
    // style changes again); either way the exit is over.
    Promise.allSettled(animations.map(a => a.finished)).then(() => {
      if (!cancelled) setMounted(false);
    });
    return () => {
      cancelled = true;
    };
  }, [present, mounted]);

  if (!mounted) return null;

  return React.cloneElement(children as ReactElement<{ ref?: Ref<HTMLElement> }>, { ref: nodeRef });
}
