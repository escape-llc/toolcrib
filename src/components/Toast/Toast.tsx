'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Toast as ToastPrimitive } from 'radix-ui';
import { type ToastItem, type ToastAnchor, useToast } from './ToastContext';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { useNonce } from '../../theme/nonceContext';
import { useAdaptiveSize } from '../../observer/useAdaptiveSize';
import { resolveColorVariant } from '../../theme/colorVariant';
import { useLocaleStrings } from '../Locale/LocaleContext';

const TOAST_STYLE_ID = 'toolcrib-toast-animations';

/** Vertical gap between stacked toasts, in px -- matches the old flex Viewport's own `gap: 0.625rem`. */
const TOAST_STACK_GAP_PX = 10;
/** Assumed height for a just-mounted toast before its real one is measured (see `useAdaptiveSize` below) -- close enough that the very first frame doesn't visibly jump once the real measurement arrives a tick later. */
const TOAST_ESTIMATED_HEIGHT_PX = 72;
/**
 * The Viewport's own inset from the screen edge -- used both on the
 * Viewport itself (`getPositionStyles`, below) AND on each individual
 * toast's own `top`/`right`/`bottom`/`left` (`ToastItemComponent`'s
 * style). One shared constant, not two independently-typed literals of
 * the same value, specifically because a real bug already came from
 * exactly that kind of drift here -- see `ToastItemComponent`'s own
 * comment on why an absolutely positioned toast needs this explicitly:
 * the Viewport's own `padding` alone no longer does anything for it once
 * it's no longer an in-flow child.
 */
const TOAST_VIEWPORT_PADDING = 'var(--ai-padding-xl, 1rem)';

// Every toast is positioned via `transform: translateY(var(--stack-offset))`
// -- computed arithmetic (each toast's own measured height + a fixed gap,
// summed over the toasts ahead of it), not layout reflow -- rather than
// the previous `grid-template-rows` height-collapse approach. That
// approach reflowed the whole flex list on every frame of every toast's
// own exit animation (a real layout recalculation, not just paint/
// composite), which is exactly the class of animation prone to visible
// stutter under any other page work happening at the same time -- reported
// directly as "the movement is horrible... whatever is driving this is
// janky as hell." A `transform` change, by contrast, is compositor-only:
// no layout, no paint, just a compositing-thread transform update, which
// is why this reads as smooth regardless of what else the page is doing.
//
// This also directly produces the requested behavior for free: a toast
// that's dismissed is EXCLUDED from the offset-accumulation math (see
// ToastContainer's own `closingIds` state below) the instant it starts
// closing, so every OTHER toast's `--stack-offset` immediately recomputes
// to its new (slid-up-or-down) position and transitions there smoothly —
// while the closing toast itself keeps whatever `--stack-offset` it had
// the moment it started closing (nothing recomputes it once it's in
// `closingIds`), so it visually just fades in place instead of moving.
// "The first toast should just fade out, the remaining toasts slide" is
// exactly this: two toasts, two different `--stack-offset` update rules,
// same underlying mechanism.
//
// Radix's Toast Root is wrapped in Presence: once `open` goes false (i.e.
// `data-state` flips to "closed"), Presence keeps the DOM node mounted
// until a real `animationend` fires on it before actually removing it —
// confirmed the hard way for Tooltip (see Tooltip.tsx's own comment on the
// exact same class of bug). An inline `style.animation` can't express
// "play THIS keyframe on data-state=open, a DIFFERENT one on closed" (its
// value doesn't change between renders just because a data-attribute did,
// so the browser never restarts it) — real `[data-state]`/`[data-swipe]`
// selectors need a real stylesheet, hence injecting one instead of relying
// on inline styles like the rest of this component's styling does.
//
// `--toast-transform-base` is a second, separately-set CSS variable (only
// given a value for `top-center`/`bottom-center` anchors, where a toast
// needs its own `translateX(-50%)` to center itself on its anchored point
// in addition to the stacking `translateY`) -- referenced with an empty
// fallback (`var(--toast-transform-base, )`) everywhere below so every
// other anchor's `transform` starts directly with `translateY(...)` and
// this variable can stay entirely unset for them.
function injectToastAnimations(targetDocument?: Document, nonce?: string): void {
  injectGlobalStyle(
    TOAST_STYLE_ID,
    `
    @keyframes toolcrib-toast-slide-in {
      from { opacity: 0; transform: var(--toast-transform-base, ) translateY(calc(var(--stack-offset, 0px) + 0.5rem)) scale(0.96); }
      to { opacity: 1; transform: var(--toast-transform-base, ) translateY(var(--stack-offset, 0px)) scale(1); }
    }
    @keyframes toolcrib-toast-fade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes toolcrib-toast-swipe-out {
      0% { transform: var(--toast-transform-base, ) translateY(var(--stack-offset, 0px)) translateX(var(--radix-toast-swipe-end-x, 0)); opacity: 1; }
      50% { transform: var(--toast-transform-base, ) translateY(var(--stack-offset, 0px)) translateX(150%); opacity: 0; }
      100% { transform: var(--toast-transform-base, ) translateY(var(--stack-offset, 0px)) translateX(150%); opacity: 0; }
    }
    .ai-toast-root[data-state="open"] {
      animation: toolcrib-toast-slide-in var(--ai-transition-duration-normal, 220ms) var(--ai-transition-easing, cubic-bezier(0.4, 0, 0.2, 1));
      transform: var(--toast-transform-base, ) translateY(var(--stack-offset, 0px));
      transition: transform var(--ai-toast-stack-duration, 260ms) var(--ai-transition-easing, cubic-bezier(0.4, 0, 0.2, 1));
    }
    .ai-toast-root[data-state="closed"]:not([data-swipe="end"]) {
      animation: toolcrib-toast-fade-out var(--ai-toast-exit-duration, 240ms) ease forwards;
      /* Deliberately no transition here and no change to --stack-offset
         while closing (see ToastContainer's own comment) -- this toast
         stays exactly where it already was, only its opacity moves. */
      transform: var(--toast-transform-base, ) translateY(var(--stack-offset, 0px));
    }
    .ai-toast-root[data-swipe="move"] {
      transform: var(--toast-transform-base, ) translateY(var(--stack-offset, 0px)) translateX(var(--radix-toast-swipe-move-x, 0));
    }
    .ai-toast-root[data-swipe="cancel"] {
      transform: var(--toast-transform-base, ) translateY(var(--stack-offset, 0px)) translateX(0);
      transition: transform 0.2s ease-out;
    }
    .ai-toast-root[data-swipe="end"] {
      animation: toolcrib-toast-swipe-out var(--ai-toast-swipe-exit-duration, 400ms) ease-out forwards;
    }
    `,
    targetDocument,
    nonce
  );
}

/** @barrelExport */
export interface ToastProps {
  toast: ToastItem;
  /**
   * Which screen edge this toast stacks from -- governs which side its
   * `position: absolute` placement anchors to and whether a center anchor
   * needs its own `translateX(-50%)`. Only meaningful when rendered inside
   * `<ToastContainer>` (which supplies it); a standalone `<ToastItemComponent>`
   * with no container defaults to `'top-right'`, matching `ToastProvider`'s
   * own default.
   * @default 'top-right'
   */
  anchor?: ToastAnchor;
  /**
   * This toast's own vertical offset (px) within its stack, computed by
   * `<ToastContainer>` from every other visible toast's measured height —
   * see `injectToastAnimations`'s own comment for why this replaced a
   * height-collapse/reflow approach. Defaults to `0` (top/bottom of the
   * stack) for standalone use with no container.
   * @default 0
   */
  stackOffset?: number;
  /** Reports this toast's own real rendered height (px) whenever it changes, so a container can recompute every other toast's `stackOffset`. No-op by default. */
  onHeightChange?: (id: string, height: number) => void;
  /** Called once, the instant this toast begins closing (for any reason) -- lets a container freeze this toast's `stackOffset` instead of continuing to recompute it as it fades. No-op by default. */
  onClosingChange?: () => void;
}

export const ToastItemComponent: React.FC<ToastProps> = ({
  toast,
  anchor = 'top-right',
  stackOffset = 0,
  onHeightChange,
  onClosingChange,
}) => {
  const { dismissToast } = useToast();
  const strings = useLocaleStrings().toast;
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  useEffect(() => {
    injectToastAnimations(targetDocument, nonce);
  }, [targetDocument, nonce]);

  // Real measured height, reported up to the container so it can compute
  // every OTHER toast's own stackOffset from it -- see
  // injectToastAnimations' own comment for why this replaced the previous
  // height-collapse-and-let-flex-reflow approach entirely.
  const rootRef = useRef<HTMLLIElement>(null);
  const { height } = useAdaptiveSize(rootRef);
  useEffect(() => {
    if (height > 0) onHeightChange?.(toast.id, height);
  }, [height, toast.id, onHeightChange]);
  useInjectInteractionStyles();

  // ToastPrimitive.Root is given the same `duration` below and runs its own
  // internal auto-dismiss timer, which — per Radix's documented Toast
  // behavior — pauses while the toast is hovered/focused, so it doesn't
  // disappear mid-read. A second, independently-scheduled setTimeout here
  // (the previous implementation) had no concept of hover at all: it kept
  // counting down regardless, so it could fire and dismiss the toast out
  // from under a user actively reading it — defeating Radix's own
  // accessibility behavior. Radix is now the only timer.
  //
  // The one thing that timer was also doing — distinguishing "timed out"
  // from "user dismissed" for the `reason` field and the `toast:expired`
  // event — still needs answering, since Radix's onOpenChange(false) fires
  // identically for a timeout, a swipe-to-dismiss, an explicit close click,
  // or a "close all" shortcut, without saying which.
  //
  // dismissReasonRef records *why* as soon as it's known (a click, a swipe,
  // or Radix's own duration timer firing) but deliberately does NOT call
  // dismissToast yet — see finalize()/onAnimationEnd below for why: doing
  // so immediately was a real bug (toasts never animated on dismiss/expiry,
  // reported directly), because dismissToast removes the toast from
  // ToastContext's `toasts` array, and ToastContainer maps directly over
  // that array — so an immediate removal unmounts this whole
  // <ToastPrimitive.Root>. Radix's Presence (used internally by Root) only
  // defers UNMOUNTING ITS OWN CHILDREN until a real animationend; it can't
  // defer anything once an ancestor stops rendering it, which is exactly
  // what happened. The fix keeps this component mounted — and the exit
  // animation playing — until that real animationend fires.
  const dismissReasonRef = useRef<'user' | 'expired' | 'action' | null>(null);
  // Tracks whether the current close is a swipe-to-dismiss, to tell it
  // apart from a genuine timeout in onOpenChange below (both call it
  // identically). onSwipeCancel resets this when a drag is released before
  // the dismiss threshold — the toast stays open and its timer keeps
  // running, so if it's still false when that timer eventually does fire,
  // the later dismissal is correctly reported as 'expired', not 'user'.
  const swipedRef = useRef(false);
  // Removes the toast from state once its exit animation genuinely
  // finishes. The backstop setTimeout in onOpenChange below is a bound in
  // case animationend never fires at all (e.g. a consumer's own global
  // stylesheet disables animations via `prefers-reduced-motion` +
  // `!important`) so a toast can never get stuck in the DOM forever — the
  // same class of bug this toolkit hit before for Tooltip with a missing
  // @keyframes. finalizedRef guards the backstop against double-firing
  // after a real animationend already handled it.
  const finalizedRef = useRef(false);
  // Reported to the container exactly once per toast, the instant it
  // starts closing (any reason) -- see injectToastAnimations' own comment
  // for why this is what lets OTHER toasts recompute their stackOffset
  // immediately while this one's own offset stays frozen.
  const closingReportedRef = useRef(false);
  const finalize = (reason: 'user' | 'expired' | 'action') => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    dismissToast(toast.id, reason);
  };

  // Both always non-null: toast.type is always one of the 4 SubthemeName
  // values, and resolveColorVariant only returns null when neither
  // `subtheme` nor `variant` is given. Replaces this component's own
  // previous hand-rolled 4-way switch per color (background/border/accent)
  // -- the same shared resolver Badge's own subtheme/variant options build
  // on, so both don't re-derive the same 4-color lookup independently.
  const softColors = resolveColorVariant({ subtheme: toast.type })!;
  const outlineColors = resolveColorVariant({ subtheme: toast.type, appearance: 'outline' })!;

  return (
    <ToastPrimitive.Root
      data-testid="toast-item"
      className="ai-toast-root ai-focus-ring"
      duration={toast.sticky ? Infinity : (toast.duration || 5000)}
      onSwipeStart={() => { swipedRef.current = true; }}
      onSwipeCancel={() => { swipedRef.current = false; }}
      onOpenChange={(open) => {
        if (open) return;
        if (!closingReportedRef.current) {
          closingReportedRef.current = true;
          onClosingChange?.();
        }
        if (!dismissReasonRef.current) {
          // No explicit click already recorded a reason — this is either a
          // swipe-to-dismiss or Radix's own duration timer firing.
          if (swipedRef.current) {
            dismissReasonRef.current = 'user';
          } else {
            aiBus.emit('toast:expired', { id: toast.id, message: toast.message, type: toast.type });
            dismissReasonRef.current = 'expired';
          }
        }
        // Backstop only -- see finalize's own comment. The real removal
        // path is onAnimationEnd below, which fires much sooner (as soon
        // as the exit animation itself finishes) than this fallback.
        window.setTimeout(() => finalize(dismissReasonRef.current!), 1000);
      }}
      onAnimationEnd={(e) => {
        if (
          dismissReasonRef.current &&
          (e.animationName === 'toolcrib-toast-fade-out' || e.animationName === 'toolcrib-toast-swipe-out')
        ) {
          finalize(dismissReasonRef.current);
        }
      }}
      ref={rootRef}
      style={{
        borderRadius: 'var(--ai-radius-lg, 0.5rem)',
        background: `linear-gradient(135deg, ${softColors.background} 0%, var(--ai-bg-surface, #ffffff) 100%)`,
        color: 'var(--ai-text-primary, #111827)',
        border: `0.0625rem solid ${softColors.border}`,
        borderLeft: `var(--ai-toast-accent-width, 0.3125rem) solid ${outlineColors.color}`,
        boxShadow: 'var(--ai-toast-shadow, 0 0.625rem 0.9375rem -0.1875rem rgba(0,0,0,0.12), 0 0.25rem 0.375rem -0.125rem rgba(0,0,0,0.06))',
        minWidth: '17.5rem',
        maxWidth: '26.25rem',
        outline: 'none',
        // Positioned directly, not via the (flex, no-longer-stacking)
        // Viewport -- see injectToastAnimations' own comment. Anchored to
        // the same edge/side the Viewport itself is (getPositionStyles in
        // ToastContainer below), since Root's real rendered output is a
        // direct child of the Viewport's <ol> via Radix's portal (see the
        // pointerEvents comment right below) and so shares its containing
        // block. `--stack-offset`/`--toast-transform-base` feed the
        // stylesheet rules that actually apply the transform.
        //
        // The inset below is TOAST_VIEWPORT_PADDING (matching the
        // Viewport's own `padding` in getPositionStyles), not a literal
        // `0` -- a real bug found via a real-browser measurement, not
        // reasoned out in advance: for an absolutely positioned element,
        // `top`/`right`/etc. are measured from the containing block's
        // PADDING-BOX edge, which coincides with its BORDER-BOX edge (the
        // Viewport has no border), not inset by the padding value itself
        // -- padding only ever creates visual space for genuinely in-flow
        // children, which these no longer are. `top: 0` rendered every
        // toast flush against the literal screen edge instead of the
        // intended ~1rem inset, confirmed via getBoundingClientRect (0,
        // not ~16) in e2e/toast-stacking.spec.ts.
        position: 'absolute',
        [anchor.startsWith('bottom') ? 'bottom' : 'top']: TOAST_VIEWPORT_PADDING,
        ...(anchor.endsWith('center')
          ? { left: '50%' }
          : anchor.endsWith('left')
            ? { left: TOAST_VIEWPORT_PADDING }
            : { right: TOAST_VIEWPORT_PADDING }),
        ['--stack-offset' as string]: `${stackOffset}px`,
        ...(anchor.endsWith('center') ? { ['--toast-transform-base' as string]: 'translateX(-50%)' } : {}),
        // Confirmed via a real browser run (DOM dump + computed-style walk):
        // Radix's ToastPrimitive.Root portals its actual rendered content to
        // be a direct child of the Viewport's <ol>, not a descendant of
        // whatever wrapper the consumer places around <ToastPrimitive.Root>
        // in JSX. ToastContainer below used to rely on a per-toast wrapper
        // <div style={{ pointerEvents: 'auto' }}> to counteract the
        // Viewport's own pointerEvents: 'none' (needed so the empty space
        // around toasts stays click-through) — but since the portal moves
        // this Root's real output out from under that div entirely, the div
        // was overriding pointer-events on an empty shell while the actual
        // toast (this element and everything inside it, including the
        // dismiss button) kept inheriting 'none' straight from the Viewport.
        // Every click on a toast's close/action button was silently
        // swallowed and fell through to whatever was underneath on the page
        // — reproduced exactly as reported: dismiss appeared to do nothing,
        // and the click landed on the header button one toast happened to
        // overlap instead. Setting it here, on the element that's actually
        // still a real ancestor of the dismiss/action buttons after the
        // portal, is what actually fixes it.
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
          padding: 'var(--ai-padding-lg, 0.75rem 1rem)',
        }}
      >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', minHeight: 0 }}>
            {/* minHeight:0 -- also a flex item of the row above (its own
                display:'block' doesn't exempt it: a flex item's
                min-height:auto resolves to its own min-content size
                regardless of its display type), same fix as its siblings
                for the same reason. */}
            <div style={{ minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', minHeight: 0 }}>
                {toast.title && (
                  <ToastPrimitive.Title style={{ fontWeight: 'var(--ai-font-weight-semibold, 600)', fontSize: '0.9rem' }}>
                    {toast.title}
                  </ToastPrimitive.Title>
                )}
                {toast.sticky && (
                  <span style={{ fontSize: '0.6875rem', padding: 'var(--ai-padding-xs, 0.0625rem 0.375rem)', borderRadius: 'var(--ai-radius-sm, 0.25rem)', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--ai-subtheme-error, #ef4444)', fontWeight: 'var(--ai-font-weight-bold, 700)' }}>
                    📌 Sticky
                  </span>
                )}
              </div>
              <ToastPrimitive.Description style={{ fontSize: '0.875rem' }}>
                {toast.message}
              </ToastPrimitive.Description>
            </div>

            <ToastPrimitive.Close
              aria-label={strings.dismissToast}
              onClick={() => { dismissReasonRef.current = 'user'; }}
              className="ai-btn"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--ai-text-secondary, #6b7280)',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: 'var(--ai-padding-xs, 0.125rem 0.375rem)',
                minHeight: 0,
                ['--ai-btn-bg' as string]: 'transparent',
              }}
            >
              ×
            </ToastPrimitive.Close>
          </div>

          {toast.actions && toast.actions.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', minHeight: 0 }}>
              {toast.actions.map((act, i) => (
                <ToastPrimitive.Action
                  key={i}
                  altText={act.label}
                  onClick={() => {
                    aiBus.emit('toast:action_clicked', {
                      id: toast.id,
                      actionLabel: act.label,
                      message: toast.message,
                    });
                    act.onClick();
                    dismissReasonRef.current = 'action';
                  }}
                  className="ai-btn"
                  style={{
                    padding: 'var(--ai-padding-xs, 0.25rem 0.625rem)',
                    borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                    border: `0.0625rem solid ${outlineColors.color}`,
                    background: 'transparent',
                    color: outlineColors.color,
                    fontSize: '0.75rem',
                    fontWeight: 'var(--ai-font-weight-semibold, 600)',
                    cursor: 'pointer',
                    ['--ai-btn-bg' as string]: 'transparent',
                  }}
                >
                  {act.label}
                </ToastPrimitive.Action>
              ))}
            </div>
          )}
        </div>
    </ToastPrimitive.Root>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, anchor } = useToast();

  // Each visible toast's own real measured height (px), reported by
  // ToastItemComponent's onHeightChange -- the arithmetic input for the
  // stackOffset computed below. Ids no longer present in `toasts` are
  // pruned by the cleanup effect further down, so this can't grow forever
  // across a long session with many toasts cycling through.
  const [heights, setHeights] = useState<Record<string, number>>({});
  // Ids currently playing their exit animation -- excluded from the
  // offset-accumulation loop below so every OTHER toast immediately
  // recomputes its own stackOffset and slides into place, while a closing
  // toast's own offset (read from frozenOffsets, captured at the instant
  // it started closing) never changes again. See injectToastAnimations'
  // own comment for the full reasoning.
  const [closingIds, setClosingIds] = useState<Set<string>>(new Set());
  // A closing toast's own stackOffset, snapshotted once at the moment it
  // starts closing -- see the onClosingChange call site below, which
  // captures the CURRENT render's own computed offset into the closure
  // passed down as the prop, rather than reading a mutable ref during
  // render (not allowed under this repo's own react-hooks/refs rule).
  const [frozenOffsets, setFrozenOffsets] = useState<Record<string, number>>({});

  const handleHeightChange = useCallback((id: string, height: number) => {
    setHeights(prev => (prev[id] === height ? prev : { ...prev, [id]: height }));
  }, []);

  const handleClosingChange = useCallback((id: string, offsetAtCloseTime: number) => {
    setClosingIds(prev => (prev.has(id) ? prev : new Set(prev).add(id)));
    setFrozenOffsets(prev => (id in prev ? prev : { ...prev, [id]: offsetAtCloseTime }));
  }, []);

  // Prunes state for any id no longer in `toasts` at all (its real removal
  // already happened via dismissToast, well after its own exit animation
  // and this container's own closingIds bookkeeping are done with it) --
  // without this, heights/closingIds/frozenOffsets would grow forever
  // across a session with many toasts cycling through. Not "derive state
  // from props during render instead" territory: nothing rendered here
  // ever depends on a stale entry's absence (offsetFor only ever looks up
  // ids that are actually in `toasts`), so this is real bookkeeping
  // cleanup bounding long-session memory growth, not a substitute for a
  // render-time computation -- each setter's own `stale.length === 0`
  // check already keeps this a no-op on every render where nothing
  // actually needs pruning.
  useEffect(() => {
    const liveIds = new Set(toasts.map(t => t.id));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeights(prev => {
      const stale = Object.keys(prev).filter(id => !liveIds.has(id));
      if (stale.length === 0) return prev;
      const next = { ...prev };
      stale.forEach(id => delete next[id]);
      return next;
    });
    setClosingIds(prev => {
      const stale = [...prev].filter(id => !liveIds.has(id));
      if (stale.length === 0) return prev;
      const next = new Set(prev);
      stale.forEach(id => next.delete(id));
      return next;
    });
    setFrozenOffsets(prev => {
      const stale = Object.keys(prev).filter(id => !liveIds.has(id));
      if (stale.length === 0) return prev;
      const next = { ...prev };
      stale.forEach(id => delete next[id]);
      return next;
    });
  }, [toasts]);

  if (toasts.length === 0) return null;

  // Stacking order: index 0 is the toast nearest the anchor's own screen
  // edge. For a bottom anchor that's the LAST entry in `toasts` (the most
  // recently added/highest-priority toast rises from the bottom edge and
  // stays closest to it) -- matching the previous plain-flex layout's own
  // visual order exactly, just computed explicitly now instead of left to
  // the browser's own flow.
  const stackOrder = anchor.startsWith('bottom') ? [...toasts].slice().reverse() : toasts;
  let cumulative = 0;
  const openOffsets = new Map<string, number>();
  stackOrder.forEach(t => {
    if (closingIds.has(t.id)) return; // excluded from the flow entirely -- see handleClosingChange's own comment
    openOffsets.set(t.id, cumulative);
    cumulative += (heights[t.id] ?? TOAST_ESTIMATED_HEIGHT_PX) + TOAST_STACK_GAP_PX;
  });
  const offsetFor = (id: string): number => (closingIds.has(id) ? (frozenOffsets[id] ?? 0) : (openOffsets.get(id) ?? 0));

  const getPositionStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      zIndex: Z_INDEX.TOAST,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.625rem',
      padding: TOAST_VIEWPORT_PADDING,
      pointerEvents: 'none',
      margin: 0,
      listStyle: 'none',
      outline: 'none',
    };

    switch (anchor) {
      case 'top-right':
        return { ...base, top: 0, right: 0, alignItems: 'flex-end' };
      case 'top-left':
        return { ...base, top: 0, left: 0, alignItems: 'flex-start' };
      case 'bottom-right':
        return { ...base, bottom: 0, right: 0, alignItems: 'flex-end' };
      case 'bottom-left':
        return { ...base, bottom: 0, left: 0, alignItems: 'flex-start' };
      case 'top-center':
        return { ...base, top: 0, left: '50%', transform: 'translateX(-50%)', alignItems: 'center' };
      case 'bottom-center':
        return { ...base, bottom: 0, left: '50%', transform: 'translateX(-50%)', alignItems: 'center' };
    }
  };

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      <ToastPrimitive.Viewport className="ai-focus-ring" style={getPositionStyles()}>
        {/* No per-toast wrapper div here — see ToastItemComponent's own
            pointerEvents: 'auto' comment for why one existed before and why
            it never actually worked (ToastPrimitive.Root portals its real
            output out from under it, straight to this Viewport). */}
        {toasts.map(toast => (
          <ToastItemComponent
            key={toast.id}
            toast={toast}
            anchor={anchor}
            stackOffset={offsetFor(toast.id)}
            onHeightChange={handleHeightChange}
            onClosingChange={() => handleClosingChange(toast.id, offsetFor(toast.id))}
          />
        ))}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Provider>
  );
};
