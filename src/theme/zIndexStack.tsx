'use client';

import { useLayoutEffect, useState } from 'react';
import { Z_INDEX, type ZIndexScale } from './zIndex';

// Each nested/simultaneous instance of the same tier gets a slot this wide,
// large enough to hold a component's own internal backdrop/content offset
// (Modal/Drawer/AlertDialog all use `base` for the backdrop and `base + 1`
// for the content) without a later instance's backdrop ever tying with an
// earlier instance's content. 10 instances of the same tier open at once
// (200 -> 290) stays comfortably inside the 100-wide gap to the next tier
// (DROPDOWN, 300) -- a realistic ceiling for real nesting depth.
const SLOT_WIDTH = 10;

class ZIndexStackManager {
  // Tracks which specific depth slots are currently occupied per tier, not
  // just an active count -- an earlier version of this class tracked only
  // a count, which meant a non-LIFO unmount (open A, open B, close A, open
  // C) reused A's already-freed slot number for the *count*, but nothing
  // stopped the resulting depth from colliding with still-mounted B's own
  // depth. Found by a real unit test exercising exactly that order, not
  // reasoned out in advance.
  private occupiedDepths = new Map<ZIndexScale, Set<number>>();

  register(tier: ZIndexScale): number {
    const occupied = this.occupiedDepths.get(tier) ?? new Set<number>();
    let depth = 0;
    while (occupied.has(depth)) depth++;
    occupied.add(depth);
    this.occupiedDepths.set(tier, occupied);
    return depth;
  }

  unregister(tier: ZIndexScale, depth: number): void {
    this.occupiedDepths.get(tier)?.delete(depth);
  }
}

/** @barrelExport */
export const zIndexStackManager = new ZIndexStackManager();

/**
 * A z-index for this component instance within `tier`, guaranteed strictly
 * higher than any earlier-mounted, still-open instance of the same tier --
 * so N nested or simultaneous instances of the same overlay type (two
 * `Modal`s, one opened from inside the other) stack correctly by
 * construction, not by coincidence of portal/DOM append order. Before this
 * hook existed, every instance of a tier defaulted to the identical
 * `Z_INDEX[tier]` value, and correct stacking depended entirely on later
 * portals rendering later in the DOM -- true today, but never a real
 * guarantee (see `e2e/zindex-stress.spec.ts`'s own account of finding this).
 *
 * Registration happens in `useLayoutEffect`, not during render: React 18
 * Strict Mode double-invokes render-phase side effects without an
 * automatic way to undo them, but double-invokes effects as a genuine
 * mount -> cleanup -> mount sequence, which nets to exactly one real
 * registration as long as the cleanup correctly unregisters -- exactly
 * what this hook does. The first render of any instance (nested or not)
 * uses the plain tier base as a safe initial value; `useLayoutEffect` runs
 * before the browser paints, so the corrected, depth-boosted value is what
 * actually reaches the screen, not a visible jump on the next frame.
 */
export function useStackedZIndex(tier: ZIndexScale): number {
  const [zIndex, setZIndex] = useState<number>(Z_INDEX[tier]);

  useLayoutEffect(() => {
    const depth = zIndexStackManager.register(tier);
    // This *is* the registration, not a reaction to some later external
    // change -- a depth slot must be assigned exactly once, synchronously,
    // inside an effect (the only place double-invocation under Strict Mode
    // nets out correctly, via mount -> cleanup -> mount) and the result has
    // no way to reach this render except through setState.
    // useSyncExternalStore doesn't fit this shape: it hands every
    // subscriber the same shared snapshot, not a unique per-caller value,
    // and there's no snapshot to read until this exact registration happens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setZIndex(Z_INDEX[tier] + depth * SLOT_WIDTH);
    return () => {
      zIndexStackManager.unregister(tier, depth);
    };
    // tier is treated as fixed for a given component instance's lifetime --
    // no consumer of this hook allows changing tiers after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return zIndex;
}
