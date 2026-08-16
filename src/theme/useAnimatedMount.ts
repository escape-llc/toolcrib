import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** @barrelExport */
export interface UseAnimatedMountResult {
  /** Whether the component should render/mount at all. */
  isMounted: boolean;
  /** Whether the exit (close) animation should be playing right now. */
  isClosing: boolean;
  /**
   * Call this from the relevant element's `onAnimationEnd` (filtered to
   * the exit animation's own name — a bubbled `animationend` from an
   * unrelated child, or the entrance animation finishing, must not
   * trigger it) once the real exit animation completes. Also invoked
   * automatically by a bounded backstop timer if no matching event ever
   * arrives, so the component can never get stuck mounted forever.
   */
  finalizeClose: () => void;
}

/**
 * Drives a hand-rolled overlay's mount lifecycle off a real exit-animation
 * `animationend`, not a guessed `setTimeout` duration — extracted after
 * that exact guessed-duration pattern caused two separate, real bugs this
 * session (Toast's exit animation never actually playing before removal;
 * SlideOut's drawer staying mounted — backdrop and all, still blocking
 * clicks — after a `setTimeout(..., 250)` meant to match its own themeable
 * `--ai-slideout-duration` variable, which the constant could silently
 * drift from, or simply lose a race against React's own effect scheduling
 * under things like StrictMode's double-invoked effects). Both bugs were
 * fixed the same way: keep the component mounted through its exit
 * animation and only actually unmount once a real `animationend` (or, as a
 * bounded fallback, a generous timer) confirms it's done — this hook is
 * that fix, generalized so the next hand-rolled animated overlay gets it
 * for free instead of re-deriving it.
 *
 * Not a fit for every animated component here: anything built on a Radix
 * primitive (`Modal`, `Popup`, `AlertDialog`, `DropdownMenu`, `Tooltip`,
 * `Select`, ...) already gets equivalent behavior from Radix's own
 * `Presence`, as long as the consumer keeps rendering it (see `Toast.tsx`'s
 * own comment on the one way that assumption broke). Reach for this hook
 * specifically for a hand-rolled overlay with no Radix primitive
 * underneath, the position `SlideOut` (built on the generic `Portal.Root`)
 * was in.
 *
 * @param isOpen Whether the component should currently be open/visible.
 * @param backstopMs Fallback delay before finalizing anyway if no matching
 *   animationend ever fires (e.g. a consumer's global stylesheet disables
 *   animations via `prefers-reduced-motion` + `!important`). @default 600
 */
export function useAnimatedMount(isOpen: boolean, backstopMs = 600): UseAnimatedMountResult {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  // Guards finalizeClose against double-firing once a real animationend
  // already handled it — reset at the start of each new close.
  const closeFinalizedRef = useRef(false);

  // useLayoutEffect, not useEffect — same reasoning, and the same
  // reproduced bug class, as SlideOut's own Escape-key listener (see that
  // component's comment). Deferring this to a regular useEffect left a
  // real gap: a close triggered fast enough after open (a native-listener
  // driven Escape press being the concrete repro — SlideOut's own listener
  // now attaches synchronously via useLayoutEffect, but this hook's
  // isMounted flip was still deferred) could have its `setIsOpen(false)`
  // render committed BEFORE this effect's `setIsMounted(true)` from the
  // *opening* transition had run — so `isMounted` was still `false` when
  // the closing render's `else if (isMounted)` check ran, meaning
  // `isClosing` never got set at all. The component was then stuck
  // rendering its OPEN state forever: isOpen=false but isMounted
  // (eventually, once the stale effect got around to running) becomes
  // true with isClosing staying false — no close animation, no backstop
  // timer, nothing to ever unmount it.
  useLayoutEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      setIsClosing(false);
    } else if (isMounted) {
      setIsClosing(true);
      closeFinalizedRef.current = false;
    }
    // isMounted deliberately excluded — this effect should only react to
    // isOpen changing, reading isMounted's current value at that moment,
    // not re-run just because finalizeClose below also sets it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const finalizeClose = () => {
    if (closeFinalizedRef.current) return;
    closeFinalizedRef.current = true;
    setIsMounted(false);
    setIsClosing(false);
  };

  useEffect(() => {
    if (!isClosing) return;
    const timer = setTimeout(finalizeClose, backstopMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClosing, backstopMs]);

  return { isMounted, isClosing, finalizeClose };
}
