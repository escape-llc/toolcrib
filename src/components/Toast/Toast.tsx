import React, { useRef } from 'react';
import { Toast as ToastPrimitive } from 'radix-ui';
import { ToastItem, useToast } from './ToastContext';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';

/** @barrelExport */
export interface ToastProps {
  toast: ToastItem;
}

export const ToastItemComponent: React.FC<ToastProps> = ({ toast }) => {
  const { dismissToast } = useToast();

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
  // The explicit dismiss paths (the ✕ button, an action button) look like
  // they call dismissToast with their own correct reason and never reach
  // onOpenChange at all — but ToastClose/ToastAction are built on Radix's
  // shared close primitive, which composes the consumer's onClick with
  // Radix's own onClose (setOpen(false)) right after it, in the same click.
  // That fires onOpenChange(false) synchronously immediately following the
  // explicit dismissToast call, so without dismissedRef this branch would
  // treat every button-driven dismissal as a second, spurious "expired"
  // event on top of the correct one. dismissedRef lets onOpenChange
  // recognize "I already know why this closed" and no-op.
  const dismissedRef = useRef(false);
  // Tracks whether the current close is a swipe-to-dismiss, to tell it
  // apart from a genuine timeout in onOpenChange below (both call it
  // identically). onSwipeCancel resets this when a drag is released before
  // the dismiss threshold — the toast stays open and its timer keeps
  // running, so if it's still false when that timer eventually does fire,
  // the later dismissal is correctly reported as 'expired', not 'user'.
  const swipedRef = useRef(false);

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
      duration={toast.sticky ? Infinity : (toast.duration || 5000)}
      onSwipeStart={() => { swipedRef.current = true; }}
      onSwipeCancel={() => { swipedRef.current = false; }}
      onOpenChange={(open) => {
        if (open) return;
        if (dismissedRef.current) return;
        if (swipedRef.current) {
          dismissToast(toast.id, 'user');
        } else {
          aiBus.emit('toast:expired', { id: toast.id, message: toast.message, type: toast.type });
          dismissToast(toast.id, 'expired');
        }
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.375rem',
        padding: '0.75rem 1rem',
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            {toast.title && (
              <ToastPrimitive.Title style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {toast.title}
              </ToastPrimitive.Title>
            )}
            {toast.sticky && (
              <span style={{ fontSize: '0.6875rem', padding: '0.0625rem 0.375rem', borderRadius: 'var(--ai-radius-sm, 0.25rem)', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--ai-subtheme-error, #ef4444)', fontWeight: 700 }}>
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
          onClick={() => { dismissedRef.current = true; dismissToast(toast.id, 'user'); }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--ai-text-secondary, #6b7280)',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: '0.125rem 0.375rem',
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
                dismissedRef.current = true;
                dismissToast(toast.id, 'action');
              }}
              style={{
                padding: '0.25rem 0.625rem',
                borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                border: `0.0625rem solid ${getSubthemeColor(toast.type)}`,
                background: 'transparent',
                color: getSubthemeColor(toast.type),
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {act.label}
            </ToastPrimitive.Action>
          ))}
        </div>
      )}
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
      padding: '1rem',
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
      <ToastPrimitive.Viewport style={getPositionStyles()}>
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
