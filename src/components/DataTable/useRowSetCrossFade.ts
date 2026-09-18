'use client';

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Cross-fades DataTable's row set when `triggerKey` changes (issues
 * #499/#517), instead of the row set snapping instantly. Originally
 * built for density changes alone ("it just slams" -- reported
 * directly) and generalized here to also cover pagination -- the
 * mechanism itself doesn't care WHAT changed inside the table, only
 * that something did, so a single implementation covers both triggers
 * (the caller combines whatever values should each independently
 * trigger a fade into one string key, e.g. `` `${density}|${page}|
 * ${pageSize}` ``).
 *
 * For density, row height and cell padding are deliberately SEPARATE,
 * independently-tuned values (`DataTableSlice.tsx`'s own
 * `DENSITY_PADDING_MULTIPLIER`/`DENSITY_ROW_HEIGHT_MULTIPLIER`), not one
 * derived from the other -- a plain CSS transition on each independently
 * would visibly desync mid-transition (one easing while the other still
 * snaps, or drifting at a different rate), reintroducing the exact
 * text-clipping mismatch a prior review already caught once. They have
 * to change atomically. For pagination, the row DATA itself changes
 * (a different page's records), which the same atomicity concern applies
 * to even more directly -- there's no partial/independent axis to desync
 * at all, the whole row set is simply different.
 *
 * The approach: rather than keeping two fully independent, fully
 * interactive `<table role="grid">` React trees mounted simultaneously
 * (which would mean extracting DataTable's entire ~800-line interactive
 * core -- virtualization, keyboard grid nav, column resize/pin, sticky
 * header -- into a second, parallel instance, a vastly larger and
 * riskier change for the identical visual result), this clones the
 * OUTGOING table's real rendered DOM as a static, `inert` snapshot,
 * overlays it directly on top of the live table (which re-renders
 * normally, immediately, at the NEW state underneath), and fades only
 * the snapshot's own opacity 1 -> 0. The live table underneath is never
 * touched, never remounted (its own React tree persists across the
 * change), and needs no separate fade-in of its own -- it's already
 * fully rendered and interactive the whole time, simply revealed as the
 * opaque snapshot on top of it fades away.
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
 *
 * `onFocusLost` (issue #517's own real, if narrow, focus concern):
 * density never remounts any row (same records, same keys, just
 * different height/padding), so focus always survives automatically
 * for that trigger -- confirmed directly via e2e, not assumed. Pagination
 * is different: `DataTable.tsx`'s own row key is `rowKey ? rowKey(record,
 * actualIndex) : actualIndex` -- with a data-derived `rowKey` (the
 * correct, recommended choice for real selection-state stability), a
 * page change gives every row a genuinely different key, so React
 * unmounts every old `<tr>` and mounts new ones. If the user's real
 * focus was on one of them, it's now gone, falling back to `<body>` --
 * a PRE-EXISTING gap in DataTable today, not something this cross-fade
 * feature introduces, but one this hook is positioned to close while
 * it's already checking exactly this. `onFocusLost` fires from the
 * layout effect below, once, only when focus was genuinely inside the
 * live table right before the change and is genuinely NOT inside it
 * anymore right after -- never for a page/pagesize change the user
 * triggered from OUTSIDE the grid (clicking a pagination button, e.g.),
 * where forcibly moving focus back into the grid would be a jarring,
 * unrequested focus-steal, not a restoration.
 *
 * Real reachability, confirmed directly (not assumed) via a genuine
 * e2e discrepancy this exact distinction was found through: a REAL
 * browser click on ANY button -- DataTable's own Next/Previous, or an
 * external consumer's own page control, doesn't matter which -- moves
 * real focus to that button as native default behavior, BEFORE React's
 * own click handler and the resulting state update/re-render even run.
 * By the time this hook's render-phase check reads
 * `document.activeElement`, a click-driven page change has ALREADY
 * moved focus to whatever was clicked -- correctly and unsurprisingly
 * failing the "was focus inside the table" check, since it genuinely
 * wasn't anymore. This is exactly the RIGHT outcome (matches the
 * "never for a page change triggered from outside the grid" case just
 * above), but it does mean `onFocusLost` can only ever fire for a page
 * change that ISN'T itself triggered by clicking a button anywhere --
 * a `page` prop changing from something else entirely (a URL/browser-
 * history sync, a live collaborative update, a timer-driven auto-
 * advance) is the real, reachable case, not "click Next while a cell
 * has focus." Covered directly at the jsdom level (`DataTable.test.tsx`,
 * via `fireEvent.click`, which -- unlike a real browser -- does NOT
 * also move real focus first, so it correctly exercises the underlying
 * restore LOGIC); not e2e-tested against a real click for this reason.
 *
 * Three real findings from an earlier review (Gemini, PR #518, when
 * this hook was still density-only and named `useDensityCrossFade`),
 * all verified and fixed, still apply here unchanged:
 * 1. `parent.removeChild(snapshot)` assumes `snapshot` is still a
 *    direct child of the exact `parent` node captured when the effect
 *    ran. `snapshot.remove()` is the equivalent DOM-standard call that
 *    silently no-ops instead of throwing if that's ever not true for a
 *    reason not fully enumerated -- free robustness, no behavioral
 *    change for the case that already worked.
 * 2. Hardcoded `width`/`margin` happen to exactly match the real
 *    `<table>`'s own unconditional style today (no `style`/`className`
 *    prop exists for a consumer to override it -- every toolcrib
 *    component strips those, see AGENTS.md's own "no component accepts
 *    style/className" rule) -- but reading the LIVE table's own computed
 *    values instead of hardcoding assumptions about them is strictly
 *    more robust against that ever changing, for zero extra cost.
 * 3. The comparison determining "did the trigger change" is tracked via
 *    `useState`, not a plain `useRef` mutated during render -- a real
 *    correctness gap under React's concurrent rendering, not just a
 *    lint nitpick: unlike `useState`, a ref mutation during a render
 *    that gets DISCARDED (StrictMode's deliberate double-invoke, or a
 *    real Concurrent Mode abort) is never rolled back, so the next
 *    actual commit could see the ref already "consumed" for a
 *    transition that never really landed, silently skipping a real
 *    change. Matches the same safely-replayed-across-discarded-renders
 *    mechanism `Popup.tsx`'s own `useActualPopoverSide`/
 *    `closedResyncKey` already establishes -- only the DOM clone/focus
 *    read itself stays a ref, since repeating those specific reads on a
 *    discarded-then-retried render is harmless, self-correcting waste
 *    (each retry re-reads whatever the CURRENT real DOM state is),
 *    never a correctness bug the way the comparison flag was.
 */
export function useRowSetCrossFade(tableRef: RefObject<HTMLTableElement | null>, triggerKey: string, onFocusLost?: () => void): void {
  const [trackedKey, setTrackedKey] = useState(triggerKey);
  const pendingSnapshotRef = useRef<HTMLElement | null>(null);
  const focusWasInsideRef = useRef(false);
  // Saved-callback ref, matching useAIEvent's own established idiom in
  // this codebase -- `onFocusLost` (DataTable.tsx's `restoreFocus`, from
  // useTableKeyboardNav) changes identity on every normal arrow-key
  // move (it depends on focusedRow/focusedCol), completely unrelated to
  // `triggerKey`. Depending on it directly in the layout effect's own
  // array below would re-run (and re-CLEAN UP) that effect on every
  // such move -- including, in the rare case of a user navigating
  // during an in-progress fade, prematurely cancelling that fade's own
  // rAF/timers and force-removing the snapshot mid-transition. This ref
  // lets the effect call whatever the LATEST callback is without ever
  // needing to be re-run just because that callback's identity changed.
  const onFocusLostRef = useRef(onFocusLost);
  useEffect(() => {
    onFocusLostRef.current = onFocusLost;
  }, [onFocusLost]);

  // Captured DURING render, not an effect -- cloneNode() (and the
  // document.activeElement containment check just below it) are pure
  // READS (cloneNode returns a new, detached node; checking
  // `.contains()` mutates nothing), so this is safe to do here despite
  // general React guidance against side effects during render. It has
  // to happen here, specifically, and can't be deferred to an effect:
  // by the time any effect for THIS render runs, React has already
  // committed this render's own new-state DOM changes, so
  // `tableRef.current` would already reflect the NEW state -- the very
  // thing this snapshot (and the focus check) needs to observe is the
  // OLD one, which only still exists in the live DOM at this exact
  // moment, before this render's mutations land. Function components
  // have no `getSnapshotBeforeUpdate`-equivalent hook for this; a ref
  // read during render is the only mechanism that can observe pre-
  // commit DOM state at all.
  //
  // `eslint-plugin-react-hooks`'s `react-hooks/refs` rule flags ANY ref
  // access during render, read or write, not just reads that influence
  // output -- confirmed directly (not assumed) against this file's own
  // real lint output. This is a deliberate, justified exception for the
  // DOM read specifically (see this hook's own comment, point 3, above,
  // for why the read itself -- unlike the comparison flag that used to
  // also live in a ref here -- is safe even if repeated across a
  // discarded/retried render): matches AGENTS.md's own "a genuine anti-
  // pattern finding can't be fixed cleanly without real behavioral
  // risk... a targeted eslint-disable-next-line with a comment
  // justifying why is correct" precedent, scoped to just this one block.
  /* eslint-disable react-hooks/refs */
  if (triggerKey !== trackedKey) {
    setTrackedKey(triggerKey);
    const table = tableRef.current;
    focusWasInsideRef.current = !!table && !!document.activeElement && table.contains(document.activeElement);
    if (table && !isMotionReduced(table)) {
      pendingSnapshotRef.current = table.cloneNode(true) as HTMLElement;
    }
  }
  /* eslint-enable react-hooks/refs */

  useLayoutEffect(() => {
    const table = tableRef.current;

    // Focus-restoration check runs regardless of whether a snapshot was
    // captured (reduced motion still needs this fixed) -- gated on
    // `focusWasInsideRef` alone, consumed (reset to false) here so it
    // only ever fires once per actual change, not on every unrelated
    // re-render afterward.
    if (focusWasInsideRef.current) {
      focusWasInsideRef.current = false;
      if (table && (!document.activeElement || !table.contains(document.activeElement))) {
        onFocusLostRef.current?.();
      }
    }

    const snapshot = pendingSnapshotRef.current;
    if (!snapshot) return;
    pendingSnapshotRef.current = null;

    const parent = table?.parentElement;
    if (!table || !parent) return;

    stripIds(snapshot);
    // `inert` isn't in React's DOM typings as a settable IDL property on
    // every target consistently across the TS DOM lib versions this repo
    // straddles (see AGENTS.md's own root/scripts TS-version split) --
    // setAttribute is the one universally-safe way to set it on a raw,
    // non-React-managed node like this one.
    snapshot.setAttribute('inert', '');
    snapshot.setAttribute('aria-hidden', 'true');
    // Read from the LIVE table's own real computed values, not
    // hardcoded assumptions about them -- exact visual alignment even
    // if a future change ever gave this width/margin any variability
    // they don't have today.
    const liveComputedStyle = getComputedStyle(table);
    Object.assign(snapshot.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: liveComputedStyle.width,
      margin: liveComputedStyle.margin,
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
      // .remove(), not parent.removeChild(snapshot) -- equivalent when
      // snapshot is still exactly parent's child (the normal case), but
      // silently no-ops instead of throwing NotFoundError if that's
      // ever not true for a reason not fully enumerated.
      snapshot.remove();
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
  }, [triggerKey, tableRef]);
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
