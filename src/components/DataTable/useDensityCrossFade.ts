'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';
import { type TableDensity } from './DataTableSlice';

/**
 * Cross-fades DataTable's row set when `density` changes (issue #499),
 * instead of row height/padding snapping instantly ("it just slams" --
 * reported directly).
 *
 * Row height and cell padding are deliberately SEPARATE, independently-
 * tuned values (`DataTableSlice.tsx`'s own `DENSITY_PADDING_MULTIPLIER`/
 * `DENSITY_ROW_HEIGHT_MULTIPLIER`), not one derived from the other -- a
 * plain CSS transition on each independently would visibly desync mid-
 * transition (one easing while the other still snaps, or drifting at a
 * different rate), reintroducing the exact text-clipping mismatch a
 * prior review already caught once. They have to change atomically.
 *
 * The approach: rather than keeping two fully independent, fully
 * interactive `<table role="grid">` React trees mounted simultaneously
 * (which would mean extracting DataTable's entire ~800-line interactive
 * core -- virtualization, keyboard grid nav, column resize/pin, sticky
 * header -- into a second, parallel instance, a vastly larger and
 * riskier change for the identical visual result), this clones the
 * OUTGOING table's real rendered DOM as a static, `inert` snapshot,
 * overlays it directly on top of the live table (which re-renders
 * normally, immediately, at the NEW density underneath), and fades only
 * the snapshot's own opacity 1 -> 0. The live table underneath is never
 * touched, never remounted, and needs no separate fade-in of its own --
 * it's already fully rendered and interactive the whole time, simply
 * revealed as the opaque snapshot on top of it fades away. This
 * satisfies the real requirement (old content stays visible with no
 * blank frame while the new content is ready underneath) with dramatically
 * less risk: the live table is the SAME React tree throughout, so focus,
 * scroll position, and every existing keyboard/interaction mechanism are
 * automatically preserved -- there's no second live instance to
 * synchronize any of that with.
 *
 * `inert` on the snapshot (not a manual `aria-hidden` + `tabindex="-1"`
 * sweep across its many focusable descendants) removes it from the
 * accessibility tree AND blocks focus/pointer-events on all of them in
 * one browser primitive -- the ticket's own explicit recommendation, and
 * the same tradeoff `AGENTS.md`'s "third-party accessibility primitive"
 * entry already argues for generally. Every `id` in the snapshot's
 * subtree is stripped before insertion so it can never collide with the
 * live table's own ids (`aria-activedescendant`/similar relationship
 * attributes must never resolve against this dead clone).
 */
export function useDensityCrossFade(tableRef: RefObject<HTMLTableElement | null>, density: TableDensity): void {
  const prevDensityRef = useRef(density);
  const pendingSnapshotRef = useRef<HTMLElement | null>(null);

  // Captured DURING render, not an effect -- cloneNode() is a pure DOM
  // READ (it returns a new, detached node; it never mutates the live
  // document), so this is safe to do here despite general React guidance
  // against side effects during render. It has to happen here,
  // specifically, and can't be deferred to an effect: by the time any
  // effect for THIS render runs, React has already committed this
  // render's own density-driven style changes to the real DOM, so
  // `tableRef.current` would already reflect the NEW density -- the very
  // thing this snapshot needs to capture is the OLD one, which only
  // still exists in the live DOM at this exact moment, before this
  // render's mutations land. Function components have no
  // `getSnapshotBeforeUpdate`-equivalent hook for this; a ref read/write
  // during render is the only mechanism that can observe pre-commit DOM
  // state at all.
  //
  // `eslint-plugin-react-hooks`'s `react-hooks/refs` rule flags ANY ref
  // access during render, read or write, not just reads that influence
  // output -- confirmed directly (not assumed) against both lines below
  // in this file's own real lint output. This is a deliberate, justified
  // exception, not a code smell to eliminate: matches AGENTS.md's own
  // "a genuine anti-pattern finding can't be fixed cleanly without real
  // behavioral risk... a targeted eslint-disable-next-line with a
  // comment justifying why is correct" precedent, scoped to just this
  // one block (not the whole file) since every OTHER ref access in this
  // hook (inside the layout effect below) is the ordinary, unflagged
  // kind.
  /* eslint-disable react-hooks/refs */
  if (density !== prevDensityRef.current) {
    prevDensityRef.current = density;
    const table = tableRef.current;
    if (table && !isMotionReduced(table)) {
      pendingSnapshotRef.current = table.cloneNode(true) as HTMLElement;
    }
  }
  /* eslint-enable react-hooks/refs */

  useLayoutEffect(() => {
    const snapshot = pendingSnapshotRef.current;
    if (!snapshot) return;
    pendingSnapshotRef.current = null;

    const table = tableRef.current;
    const parent = table?.parentElement;
    if (!table || !parent) return;

    stripIds(snapshot);
    // `inert` isn't in React's DOM typings as an settable IDL property on
    // every target consistently across the TS DOM lib versions this repo
    // straddles (see AGENTS.md's own root/scripts TS-version split) --
    // setAttribute is the one universally-safe way to set it on a raw,
    // non-React-managed node like this one.
    snapshot.setAttribute('inert', '');
    snapshot.setAttribute('aria-hidden', 'true');
    Object.assign(snapshot.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      margin: '0',
      opacity: '1',
      pointerEvents: 'none',
      // Not `Z_INDEX.*` -- this only ever needs to sit above its own
      // sibling (the live table, an implicit z-index of 0 in the same
      // local stacking context bodyRef establishes), never compete with
      // page-level overlay stacking. `no-unexplained-zindex` exempts
      // 0-2 for exactly this "local stacking order, not a real
      // z-index" shape (see its own README entry).
      zIndex: '1',
      transition: 'opacity var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease)',
    });

    parent.insertBefore(snapshot, table.nextSibling);

    let cancelled = false;
    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      snapshot.removeEventListener('transitionend', onTransitionEnd);
      clearTimeout(backupTimer);
      parent.removeChild(snapshot);
    };
    const onTransitionEnd = (e: TransitionEvent) => {
      if (e.target === snapshot && e.propertyName === 'opacity') remove();
    };
    snapshot.addEventListener('transitionend', onTransitionEnd);
    // Bounded backup, matching the identical reasoning already
    // established for DataTable's own empty->populated entrance
    // animation (`justLeftEmptyState`'s own comment): a real DOM event
    // is the precise, correct completion signal, but nothing bounds it
    // if something entirely unrelated interrupts the transition (the
    // snapshot's own parent unmounting mid-fade because of a totally
    // different prop change landing in the same window, e.g.) --
    // 2000ms is long enough to never race a real, even consumer-
    // customized `--ai-transition-duration-normal`.
    const backupTimer = setTimeout(remove, 2000);

    // Forces the browser to register the snapshot's starting (opacity:1)
    // style in a real paint before switching to the end state -- setting
    // both in the same synchronous tick would give the browser nothing
    // to actually transition FROM. Two nested frames (not one): the
    // first rAF can still land before the browser's own next paint on
    // some engines, confirmed by the same reasoning already established
    // for this exact double-rAF shape elsewhere in this codebase
    // (`Popup.tsx`'s corner-squaring, `useAdaptiveSize`'s own retry).
    let rafId: number | null = requestAnimationFrame(() => {
      if (cancelled) return;
      rafId = requestAnimationFrame(() => {
        if (cancelled) return;
        snapshot.style.opacity = '0';
      });
    });

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      remove();
    };
  }, [density, tableRef]);
}

function stripIds(root: HTMLElement): void {
  if (root.id) root.removeAttribute('id');
  root.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
}

/**
 * Reads back the theme's OWN already-resolved reduced-motion decision
 * from the live CSS variable, rather than re-deriving it separately in
 * JS (checking the `reducedMotion` slice's 'auto'/'always' values and
 * `matchMedia` independently) -- `--ai-transition-duration-normal`
 * already collapses to `0s` under `reducedMotion: 'always'`/
 * `preset: 'none'` (`animation.tsx`'s own `getAnimationVariables`), so
 * this is the single source of truth every other themed transition in
 * this codebase already keys off, just read back in JS instead of left
 * to resolve purely in CSS -- needed here specifically because the
 * ticket calls for skipping the whole cloning mechanism under reduced
 * motion, not merely letting an already-inserted clone's transition
 * collapse to an instant, still-executed no-op.
 *
 * An EMPTY/unresolved value defaults to "reduced" (skip cloning) rather
 * than "not reduced" -- confirmed for real, not assumed: a real
 * `<ThemeProvider>` always injects this variable at `:root`
 * unconditionally, so an empty read only happens when no ThemeProvider
 * is mounted at all (this repo's own `DataTable.test.tsx`, e.g., which
 * doesn't wrap every test in one). Defaulting the OTHER way broke
 * several existing tests outright: the clone mechanism still activated
 * with no real CSS transition/ThemeProvider to ever complete it, so the
 * cloned duplicate row text stayed in the jsdom document indefinitely,
 * turning single-match `getByText` queries into multi-match failures.
 */
function isMotionReduced(el: HTMLElement): boolean {
  const duration = getComputedStyle(el).getPropertyValue('--ai-transition-duration-normal').trim();
  if (duration === '') return true;
  const numeric = parseFloat(duration);
  return Number.isNaN(numeric) ? true : numeric === 0;
}
