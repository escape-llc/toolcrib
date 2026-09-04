'use client';

import React, { useRef, useEffect } from 'react';
import { Toast as ToastPrimitive } from 'radix-ui';
import { type ToastItem, useToast } from './ToastContext';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { useNonce } from '../../theme/nonceContext';
import { resolveColorVariant } from '../../theme/colorVariant';
import { useLocaleStrings } from '../Locale/LocaleContext';

const TOAST_STYLE_ID = 'toolcrib-toast-animations';

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
// The exit keyframes also animate `grid-template-rows` themselves, folding
// the fade/swipe AND the box-collapse into one single `animation` rather
// than a separate later `transition` driven by React state. This isn't a
// style preference: Presence is UNCONTROLLED here (no explicit `open` prop
// on ToastPrimitive.Root) and tracks the DOM node's *own*
// `getComputedStyle(node).animationName` directly — it has no idea a
// second, later phase exists via an unrelated `transition`, and unmounts
// the node the instant the first (fade-only) animation's animationend
// fires. Confirmed directly via a real per-frame trace: the previous
// two-phase version (a quick fade-out `animation`, then a separately
// React-state-triggered `transition: grid-template-rows` to collapse the
// box) had its own collapse phase silently never render at all — Presence
// tore the node out of the DOM the moment the fade ended, ~180ms before
// the intended 300ms collapse transition would even have started, so
// every sibling toast below it snapped up instantly instead of sliding —
// reported directly as "all the toasts flash" on expiry. A single
// animation Presence can track start-to-finish avoids the race entirely.
function injectToastAnimations(targetDocument?: Document, nonce?: string): void {
  injectGlobalStyle(
    TOAST_STYLE_ID,
    `
    @keyframes toolcrib-toast-slide-in {
      from { opacity: 0; transform: translateY(0.5rem) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes toolcrib-toast-fade-out {
      0% { opacity: 1; transform: translateY(0) scale(1); }
      37% { opacity: 0; transform: translateY(-0.25rem) scale(0.96); }
      100% { opacity: 0; transform: translateY(-0.25rem) scale(0.96); }
    }
    @keyframes toolcrib-toast-swipe-out {
      0% { transform: translateX(var(--radix-toast-swipe-end-x, 0)); opacity: 1; }
      50% { transform: translateX(150%); opacity: 0; }
      100% { transform: translateX(150%); opacity: 0; }
    }
    .ai-toast-root {
      /* A plain CSS transition (not baked into the exit @keyframes above)
         -- Chromium's fr-unit interpolation for grid-template-rows inside
         a @keyframes rule proved unreliable in practice, confirmed via a
         real per-frame trace: it snapped between only a few discrete
         values (full height, then straight to the padding's own
         intrinsic floor, ~24px) instead of interpolating smoothly, no
         matter what minmax()/min-height combination guarded against the
         usual grid-track floor. The same property driven by a plain
         transition (declared once, unconditionally, so it's always
         armed) reaches a true, smooth zero reliably. transition-delay
         below is what sequences it to start only once the fade/swipe
         portion of the *animation* (which is what Presence actually
         tracks -- see injectToastAnimations' own comment) has visually
         finished, rather than collapsing underneath a still-visible toast. */
      grid-template-rows: 1fr;
      transition: grid-template-rows var(--ai-toast-collapse-duration, 200ms) ease;
    }
    .ai-toast-root[data-state="open"] {
      animation: toolcrib-toast-slide-in var(--ai-transition-duration-normal, 220ms) var(--ai-transition-easing, cubic-bezier(0.4, 0, 0.2, 1));
      grid-template-rows: 1fr;
    }
    .ai-toast-root[data-state="closed"]:not([data-swipe="end"]) {
      animation: toolcrib-toast-fade-out var(--ai-toast-exit-duration, 320ms) var(--ai-transition-easing, cubic-bezier(0.4, 0, 0.2, 1)) forwards;
      grid-template-rows: 0fr;
      transition-delay: var(--ai-transition-duration-fast, 120ms);
    }
    .ai-toast-root[data-swipe="move"] {
      transform: translateX(var(--radix-toast-swipe-move-x, 0));
    }
    .ai-toast-root[data-swipe="cancel"] {
      transform: translateX(0);
      transition: transform 0.2s ease-out;
    }
    .ai-toast-root[data-swipe="end"] {
      animation: toolcrib-toast-swipe-out var(--ai-toast-swipe-exit-duration, 400ms) ease-out forwards;
      grid-template-rows: 0fr;
      transition-delay: 0.2s;
    }
    `,
    targetDocument,
    nonce
  );
}

/** @barrelExport */
export interface ToastProps {
  toast: ToastItem;
}

export const ToastItemComponent: React.FC<ToastProps> = ({ toast }) => {
  const { dismissToast } = useToast();
  const strings = useLocaleStrings().toast;
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  useEffect(() => {
    injectToastAnimations(targetDocument, nonce);
  }, [targetDocument, nonce]);
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
  // finishes (see injectToastAnimations' own comment for why that
  // animation now includes a grid-template-rows collapse of this toast's
  // own box down to zero height, so siblings below it slide up smoothly
  // rather than snapping the instant it's removed). backstopMs is a bound
  // in case animationend never fires at all (e.g. a consumer's own global
  // stylesheet disables animations via `prefers-reduced-motion` +
  // `!important`) so a toast can never get stuck in the DOM forever — the
  // same class of bug this toolkit hit before for Tooltip with a missing
  // @keyframes. finalizedRef guards the backstop against double-firing
  // after a real animationend already handled it.
  const finalizedRef = useRef(false);
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
      style={{
        // grid, not flex, and a single-row track -- the injected stylesheet
        // (see injectToastAnimations) drives grid-template-rows itself,
        // between 1fr (open) and 0fr (closed, via a plain CSS transition),
        // collapsing this toast's box from real content height to zero
        // without measuring pixels in JS. Deliberately NOT set here as an
        // inline value -- an inline style would always win over the
        // stylesheet's [data-state] rules regardless of specificity, which
        // is exactly what that separate mechanism needs to control.
        display: 'grid',
        minHeight: 0,
        borderRadius: 'var(--ai-radius-lg, 0.5rem)',
        background: `linear-gradient(135deg, ${softColors.background} 0%, var(--ai-bg-surface, #ffffff) 100%)`,
        color: 'var(--ai-text-primary, #111827)',
        border: `0.0625rem solid ${softColors.border}`,
        borderLeft: `var(--ai-toast-accent-width, 0.3125rem) solid ${outlineColors.color}`,
        boxShadow: 'var(--ai-toast-shadow, 0 0.625rem 0.9375rem -0.1875rem rgba(0,0,0,0.12), 0 0.25rem 0.375rem -0.125rem rgba(0,0,0,0.06))',
        minWidth: '17.5rem',
        maxWidth: '26.25rem',
        position: 'relative',
        zIndex: 3000,
        outline: 'none',
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
      {/* The direct grid item Root's animated grid-template-rows actually
          shrinks — overflow:hidden + minHeight:0, with NO padding/gap of
          its own. Same rule Accordion.tsx's own comment documents: CSS
          floors a box's *rendered* height at its own padding+border sum
          regardless of min-height/box-sizing, so the element whose height
          is actually being animated can never have padding directly on it
          — confirmed the hard way here too, not just reasoned about: this
          div used to carry the padding itself, and the collapse
          consistently stalled at exactly that padding's own pixel sum
          (~24px) instead of reaching true zero, no matter how many nested
          flex rows below also got minHeight:0 (each was a real, necessary
          fix in its own right — flex items default to min-height:auto
          regardless of display type, and none of that mattered until the
          padding itself, on the animated element, was also moved out). */}
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
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
      </div>
    </ToastPrimitive.Root>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, anchor } = useToast();

  if (toasts.length === 0) return null;

  const getPositionStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      zIndex: Z_INDEX.TOAST,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.625rem',
      padding: 'var(--ai-padding-xl, 1rem)',
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
          <ToastItemComponent key={toast.id} toast={toast} />
        ))}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Provider>
  );
};
