import React, { useRef, useEffect, useState } from 'react';
import { Toast as ToastPrimitive } from 'radix-ui';
import { type ToastItem, useToast } from './ToastContext';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';

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
function injectToastAnimations(targetDocument?: Document): void {
  injectGlobalStyle(
    TOAST_STYLE_ID,
    `
    @keyframes toolcrib-toast-slide-in {
      from { opacity: 0; transform: translateY(0.5rem) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes toolcrib-toast-fade-out {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to { opacity: 0; transform: translateY(-0.25rem) scale(0.96); }
    }
    @keyframes toolcrib-toast-swipe-out {
      from { transform: translateX(var(--radix-toast-swipe-end-x, 0)); opacity: 1; }
      to { transform: translateX(150%); opacity: 0; }
    }
    .ai-toast-root[data-state="open"] {
      animation: toolcrib-toast-slide-in var(--ai-transition-duration-normal, 220ms) var(--ai-transition-easing, cubic-bezier(0.4, 0, 0.2, 1));
    }
    .ai-toast-root[data-state="closed"]:not([data-swipe="end"]) {
      animation: toolcrib-toast-fade-out var(--ai-transition-duration-fast, 120ms) var(--ai-transition-easing, cubic-bezier(0.4, 0, 0.2, 1)) forwards;
    }
    .ai-toast-root[data-swipe="move"] {
      transform: translateX(var(--radix-toast-swipe-move-x, 0));
    }
    .ai-toast-root[data-swipe="cancel"] {
      transform: translateX(0);
      transition: transform 0.2s ease-out;
    }
    .ai-toast-root[data-swipe="end"] {
      animation: toolcrib-toast-swipe-out 0.2s ease-out forwards;
    }
    `,
    targetDocument
  );
}

/** @barrelExport */
export interface ToastProps {
  toast: ToastItem;
}

export const ToastItemComponent: React.FC<ToastProps> = ({ toast }) => {
  const { dismissToast } = useToast();
  const targetDocument = useTargetDocument();
  useEffect(() => {
    injectToastAnimations(targetDocument);
  }, [targetDocument]);
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
  // Second phase after the fade-out/swipe-out plays (see onAnimationEnd
  // below): collapses this toast's own box to zero height via a
  // grid-template-rows transition before it's actually removed from state.
  // Reported directly as a "big flash" — once the fade/slide-out fix above
  // made toasts actually animate closed, the toasts BELOW the dismissed one
  // still snapped up instantly (plain flex reflow has nothing to animate;
  // there's no discrete CSS property representing "this item's position in
  // its flex parent" for a transition to interpolate), so a smoothly-fading
  // toast sitting above instantly-relocating ones read as more jarring than
  // either alone. grid-template-rows is the standard CSS-only trick for
  // animating a collapse to/from content-driven ("auto") height without
  // measuring pixels in JS: a single-row grid's `1fr` track sizes to its
  // content, and transitioning that track to `0fr` shrinks the box over
  // real, per-frame layout recalculation — which is what makes the flex
  // siblings below slide up smoothly as a natural consequence, not a
  // faked/interpolated transform.
  const [isCollapsing, setIsCollapsing] = useState(false);
  // Actually removes the toast from state — deferred until the collapse
  // transition's real transitionend (see onTransitionEnd below), with a
  // bounded fallback in case one never fires (e.g. a consumer's own global
  // stylesheet disables animations via `prefers-reduced-motion` +
  // `!important`) so a toast can never get stuck in the DOM forever — the
  // same class of bug this toolkit hit before for Tooltip with a missing
  // @keyframes. finalizedRef guards against the fallback timer double-
  // firing after a real transitionend already handled it.
  const finalizedRef = useRef(false);
  const finalize = (reason: 'user' | 'expired' | 'action') => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    dismissToast(toast.id, reason);
  };
  const beginCollapse = (reason: 'user' | 'expired' | 'action') => {
    setIsCollapsing(true);
    // Fallback: if this toast's grid-template-rows transition never fires
    // a transitionend (see finalize's own comment), still remove it.
    window.setTimeout(() => finalize(reason), 300);
  };

  const getSubthemeColor = (type: ToastItem['type']): string => {
    switch (type) {
      case 'error': return 'var(--ai-subtheme-error, #ef4444)';
      case 'success': return 'var(--ai-subtheme-success, #10b981)';
      case 'warning': return 'var(--ai-subtheme-warning, #f59e0b)';
      case 'info': default: return 'var(--ai-subtheme-info, #3b82f6)';
    }
  };

  const getSubthemeBackground = (type: ToastItem['type']): string => {
    switch (type) {
      case 'error':
        return 'linear-gradient(135deg, var(--ai-subtheme-error-bg, rgba(239, 68, 68, 0.12)) 0%, var(--ai-bg-surface, #ffffff) 100%)';
      case 'success':
        return 'linear-gradient(135deg, var(--ai-subtheme-success-bg, rgba(16, 185, 129, 0.12)) 0%, var(--ai-bg-surface, #ffffff) 100%)';
      case 'warning':
        return 'linear-gradient(135deg, var(--ai-subtheme-warning-bg, rgba(245, 158, 11, 0.12)) 0%, var(--ai-bg-surface, #ffffff) 100%)';
      case 'info': default:
        return 'linear-gradient(135deg, var(--ai-subtheme-info-bg, rgba(59, 130, 246, 0.12)) 0%, var(--ai-bg-surface, #ffffff) 100%)';
    }
  };

  const getSubthemeBorder = (type: ToastItem['type']): string => {
    switch (type) {
      case 'error': return 'var(--ai-subtheme-error-border, rgba(239, 68, 68, 0.25))';
      case 'success': return 'var(--ai-subtheme-success-border, rgba(16, 185, 129, 0.25))';
      case 'warning': return 'var(--ai-subtheme-warning-border, rgba(245, 158, 11, 0.25))';
      case 'info': default: return 'var(--ai-subtheme-info-border, rgba(59, 130, 246, 0.25))';
    }
  };

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
        window.setTimeout(() => beginCollapse(dismissReasonRef.current!), 500);
      }}
      onAnimationEnd={(e) => {
        if (
          dismissReasonRef.current &&
          (e.animationName === 'toolcrib-toast-fade-out' || e.animationName === 'toolcrib-toast-swipe-out')
        ) {
          beginCollapse(dismissReasonRef.current);
        }
      }}
      onTransitionEnd={(e) => {
        if (dismissReasonRef.current && e.propertyName === 'grid-template-rows') {
          finalize(dismissReasonRef.current);
        }
      }}
      style={{
        // grid, not flex, and a single 1fr/0fr row — see isCollapsing's own
        // comment above for why: this is what lets the collapse transition
        // below shrink this toast's box from real content height to zero
        // without measuring pixels in JS.
        display: 'grid',
        gridTemplateRows: isCollapsing ? '0fr' : '1fr',
        transition: 'grid-template-rows 0.2s ease',
        borderRadius: 'var(--ai-radius-lg, 0.5rem)',
        background: getSubthemeBackground(toast.type),
        color: 'var(--ai-text-primary, #111827)',
        border: `0.0625rem solid ${getSubthemeBorder(toast.type)}`,
        borderLeft: `var(--ai-toast-accent-width, 0.3125rem) solid ${getSubthemeColor(toast.type)}`,
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
      {/* The single grid row's actual content — overflow:hidden + minHeight:0
          are both required for the grid-template-rows collapse trick above:
          without them this div's own intrinsic content height would keep
          it from ever visually shrinking below that, even once its parent
          row track is told to become 0fr. Padding/gap that used to live on
          Root itself moved here, since Root is now the grid container. */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
          padding: 'var(--ai-padding-lg, 0.75rem 1rem)',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
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
            aria-label="Dismiss toast"
            onClick={() => { dismissReasonRef.current = 'user'; }}
            className="ai-btn"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ai-text-secondary, #6b7280)',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: 'var(--ai-padding-xs, 0.125rem 0.375rem)',
              ['--ai-btn-bg' as string]: 'transparent',
            }}
          >
            ×
          </ToastPrimitive.Close>
        </div>

        {toast.actions && toast.actions.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
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
                  border: `0.0625rem solid ${getSubthemeColor(toast.type)}`,
                  background: 'transparent',
                  color: getSubthemeColor(toast.type),
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
