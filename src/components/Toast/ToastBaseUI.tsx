'use client';

// SPIKE (#670, Toast): toolcrib's toast system on Base UI's Toast. The public
// surface is unchanged: this serves the same ToastContext/ToastActionsContext
// (useToast/useToastActions), listens to the same toast:shown/toast:updated
// events, and emits the same toast:added/expired/dismissed/action_clicked.
// Base UI's manager replaces ToastContext's hand-rolled list and timers, and
// its measured heights replace Toast.tsx's ResizeObserver plumbing. Not for merge.
import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Toast as BaseToast } from '@base-ui/react/toast';
import {
  ToastContext,
  ToastActionsContext,
  type ToastActions,
  type ToastAnchor,
  type ToastContextType,
  type ToastItem,
} from './ToastContext';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { Z_INDEX } from '../../theme/zIndex';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { useNonce } from '../../theme/nonceContext';
import { resolveColorVariant } from '../../theme/colorVariant';
import { useLocaleStrings } from '../Locale/LocaleContext';
import { Spinner } from '../Spinner/Spinner';

type DismissReason = 'user' | 'expired' | 'action';
interface ToastData {
  item: ToastItem;
}

const STACK_GAP_PX = 10; // matches Toast.tsx's TOAST_STACK_GAP_PX
const ESTIMATED_HEIGHT_PX = 72;
const ITEM_INSET = '1rem';

const timeoutFor = (t: ToastItem) => (t.sticky || t.loading ? 0 : t.duration || 5000);
const deriveSticky = (t: ToastItem): ToastItem => {
  const sticky = Boolean(t.sticky || t.duration === 0 || t.priority === 'urgent');
  return { ...t, sticky, duration: sticky ? 0 : t.duration ?? 5000 };
};
const basePriority = (t: ToastItem): 'low' | 'high' => (t.priority === 'high' || t.priority === 'urgent' ? 'high' : 'low');

/** Drop-in for `<ToastProvider>` (spike). */
export const ToastProviderBaseUI: React.FC<{ children: ReactNode; defaultAnchor?: ToastAnchor }> = ({ children, defaultAnchor = 'top-right' }) => (
  // toolcrib stacks every toast (FIFO, no cap); Base UI defaults to 3.
  <BaseToast.Provider limit={1000}>
    <Bridge defaultAnchor={defaultAnchor}>{children}</Bridge>
  </BaseToast.Provider>
);

const Bridge: React.FC<{ children: ReactNode; defaultAnchor: ToastAnchor }> = ({ children, defaultAnchor }) => {
  const manager = BaseToast.useToastManager<ToastData>();
  const [anchor, setAnchor] = useState<ToastAnchor>(defaultAnchor);
  // Why a toast closed. Base UI's onClose doesn't say; a close button or an
  // action records its reason first, and an unrecorded close is a timeout.
  const reasons = useRef(new Map<string, DismissReason>());

  const addToast = useCallback(
    (toastData: Omit<ToastItem, 'id'> & { id?: string }): string => {
      const id = toastData.id || `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const item = deriveSticky({ id, priority: 'medium', anchor, ...toastData } as ToastItem);
      reasons.current.delete(id);
      manager.add({
        id,
        title: item.title,
        description: item.message,
        type: item.type,
        timeout: timeoutFor(item),
        priority: basePriority(item),
        data: { item },
        onClose: () => {
          if (!reasons.current.has(id)) {
            reasons.current.set(id, 'expired');
            aiBus.emit('toast:expired', { id, message: item.message, type: item.type });
          }
        },
        onRemove: () => {
          aiBus.emit('toast:dismissed', { id, message: item.message, type: item.type, reason: reasons.current.get(id) ?? 'expired' });
          reasons.current.delete(id);
        },
      });
      aiBus.emit('toast:added', { id, type: item.type, message: item.message, priority: item.priority, loading: item.loading });
      return id;
    },
    [anchor, manager]
  );

  const updateToast = useCallback(
    (id: string, patch: Partial<Omit<ToastItem, 'id'>>) => {
      manager.update(id, prev => {
        const next = deriveSticky({ ...(prev.data as ToastData).item, ...patch });
        return { title: next.title, description: next.message, type: next.type, timeout: timeoutFor(next), priority: basePriority(next), data: { item: next } };
      });
    },
    [manager]
  );

  const dismissToast = useCallback(
    (id: string, reason: DismissReason = 'user') => {
      if (!reasons.current.has(id)) reasons.current.set(id, reason);
      manager.close(id);
    },
    [manager]
  );

  const clearAll = useCallback(() => manager.close(), [manager]);

  useAIEvent('toast:shown', e => {
    addToast({ id: e.id, type: e.type, message: e.message, priority: e.priority || 'medium', loading: e.loading });
  });
  useAIEvent('toast:updated', e => {
    updateToast(e.id, { type: e.type, message: e.message, loading: e.loading });
  });

  const toasts = manager.toasts.map(t => (t.data as ToastData).item);
  // Base UI's manager methods aren't referentially stable, so the actions
  // object is built once over a ref to the latest callbacks: useToastActions()
  // consumers must not re-render when a toast is added (#632).
  const latest = useRef({ addToast, updateToast, dismissToast, clearAll });
  useEffect(() => {
    latest.current = { addToast, updateToast, dismissToast, clearAll };
  });
  const actions = useMemo<ToastActions>(
    () => ({
      addToast: t => latest.current.addToast(t),
      updateToast: (id, p) => latest.current.updateToast(id, p),
      dismissToast: (id, r) => latest.current.dismissToast(id, r),
      clearAll: () => latest.current.clearAll(),
      setAnchor,
    }),
    []
  );
  const value: ToastContextType = { toasts, addToast, updateToast, dismissToast, clearAll, setAnchor, anchor };

  return (
    <ToastActionsContext.Provider value={actions}>
      <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
    </ToastActionsContext.Provider>
  );
};

// toolcrib's keyframes, keyed on Base UI's attributes instead of Radix's
// data-state/data-swipe. Base UI keeps a closing toast mounted until its
// running animations finish.
function injectStyles(targetDocument?: Document, nonce?: string) {
  injectGlobalStyle(
    'toolcrib-toast-baseui',
    `
    @keyframes toolcrib-toast-slide-in {
      from { opacity: 0; transform: var(--toast-transform-base, ) translateY(calc(var(--stack-offset, 0px) + 0.5rem)) scale(0.96); }
      to { opacity: 1; transform: var(--toast-transform-base, ) translateY(var(--stack-offset, 0px)) scale(1); }
    }
    @keyframes toolcrib-toast-fade-out { from { opacity: 1; } to { opacity: 0; } }
    @keyframes toolcrib-toast-swipe-out {
      to { transform: var(--toast-transform-base, ) translateY(var(--stack-offset, 0px)) translateX(150%); opacity: 0; }
    }
    .ai-toast-root {
      animation: toolcrib-toast-slide-in var(--ai-transition-duration-normal, 220ms) var(--ai-transition-easing, cubic-bezier(0.4, 0, 0.2, 1));
      transform: var(--toast-transform-base, ) translateY(var(--stack-offset, 0px));
      transition: outline-color var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease), transform var(--ai-toast-stack-duration, 260ms) var(--ai-transition-easing, cubic-bezier(0.4, 0, 0.2, 1)) !important;
    }
    .ai-toast-root[data-swiping] {
      transform: var(--toast-transform-base, ) translateY(var(--stack-offset, 0px)) translateX(var(--toast-swipe-movement-x, 0px));
      transition: none !important;
    }
    .ai-toast-root[data-ending-style]:not([data-swipe-direction]) {
      animation: toolcrib-toast-fade-out var(--ai-toast-exit-duration, 240ms) ease forwards;
    }
    .ai-toast-root[data-ending-style][data-swipe-direction] {
      animation: toolcrib-toast-swipe-out var(--ai-toast-swipe-exit-duration, 400ms) ease-out forwards;
    }
    `,
    targetDocument,
    nonce
  );
}

/** Drop-in for `<ToastContainer>` (spike). */
export const ToastContainerBaseUI: React.FC = () => {
  const manager = BaseToast.useToastManager<ToastData>();
  const anchor = React.useContext(ToastContext)?.anchor ?? 'top-right';
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  useInjectInteractionStyles();
  useEffect(() => injectStyles(targetDocument, nonce), [targetDocument, nonce]);

  // FIFO stacking (oldest nearest the anchored edge) from Base UI's measured
  // heights. Base UI's own --toast-offset-y stacks newest-first (Sonner
  // style), the opposite of toolcrib's order, so offsets are computed here.
  // A closing toast leaves the flow at once (the rest slide into place) and
  // keeps the offset it had when it started closing.
  const newestFirst = manager.toasts; // Base UI prepends new toasts
  const oldestFirst = [...newestFirst].reverse();
  const stackOrder = anchor.startsWith('bottom') ? newestFirst : oldestFirst;
  const [frozen, setFrozen] = useState<Record<string, number>>({});
  const open = new Map<string, number>();
  let cumulative = 0;
  for (const t of stackOrder) {
    if (t.transitionStatus === 'ending') continue;
    open.set(t.id, cumulative);
    cumulative += (t.height || ESTIMATED_HEIGHT_PX) + STACK_GAP_PX;
  }
  const lastOpen = useRef(open);
  useEffect(() => {
    const ending = newestFirst.filter(t => t.transitionStatus === 'ending' && !(t.id in frozen));
    if (ending.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- snapshot once per closing toast
      setFrozen(prev => ({ ...prev, ...Object.fromEntries(ending.map(t => [t.id, lastOpen.current.get(t.id) ?? 0])) }));
    }
    lastOpen.current = open;
  });
  const offsetFor = (id: string, ending: boolean) => (ending ? frozen[id] ?? lastOpen.current.get(id) ?? 0 : open.get(id) ?? 0);

  if (newestFirst.length === 0) return null;
  const vertical = anchor.startsWith('bottom') ? { bottom: 0 } : { top: 0 };
  const horizontal = anchor.endsWith('left') ? { left: 0 } : anchor.endsWith('right') ? { right: 0 } : { left: '50%', transform: 'translateX(-50%)' };

  return (
    <BaseToast.Portal container={targetDocument?.body}>
      <BaseToast.Viewport
        className="ai-focus-ring"
        style={{ position: 'fixed', zIndex: Z_INDEX.TOAST, height: '100vh', width: '100%', padding: '1rem', boxSizing: 'border-box', pointerEvents: 'none', outline: 'none', ...vertical, ...horizontal }}
      >
        {oldestFirst.map(t => (
          <ToastItemBaseUI key={t.id} toast={t} anchor={anchor} stackOffset={offsetFor(t.id, t.transitionStatus === 'ending')} />
        ))}
      </BaseToast.Viewport>
    </BaseToast.Portal>
  );
};

type BaseToastObject = ReturnType<typeof BaseToast.useToastManager<ToastData>>['toasts'][number];

const ToastItemBaseUI: React.FC<{ toast: BaseToastObject; anchor: ToastAnchor; stackOffset: number }> = ({ toast: t, anchor, stackOffset }) => {
  const item = (t.data as ToastData).item;
  const actions = React.useContext(ToastActionsContext)!;
  const strings = useLocaleStrings().toast;
  const soft = resolveColorVariant({ subtheme: item.type })!;
  const outline = resolveColorVariant({ subtheme: item.type, appearance: 'outline' })!;
  return (
    <BaseToast.Root
      toast={t}
      swipeDirection="right"
      data-testid="toast-item"
      // Base UI renders each toast as role=alertdialog, which needs a name;
      // most toolcrib toasts have no title, so the message names it.
      aria-label={item.title ? undefined : item.message}
      data-loading={item.loading ? '' : undefined}
      aria-busy={item.loading || undefined}
      className="ai-toast-root ai-focus-ring"
      style={{
        position: 'absolute',
        top: anchor.startsWith('bottom') ? 'auto' : ITEM_INSET,
        bottom: anchor.startsWith('bottom') ? ITEM_INSET : 'auto',
        ...(anchor.endsWith('center') ? { left: '50%', right: 'auto' } : anchor.endsWith('left') ? { left: ITEM_INSET, right: 'auto' } : { left: 'auto', right: ITEM_INSET }),
        ['--stack-offset' as string]: `${anchor.startsWith('bottom') ? -stackOffset : stackOffset}px`,
        ...(anchor.endsWith('center') ? { ['--toast-transform-base' as string]: 'translateX(-50%)' } : {}),
        borderRadius: 'var(--ai-radius-lg, 0.5rem)',
        background: `linear-gradient(135deg, ${soft.background} 0%, var(--ai-bg-surface, #ffffff) 100%)`,
        color: 'var(--ai-text-primary, #111827)',
        border: `0.0625rem solid ${soft.border}`,
        borderLeft: `var(--ai-toast-accent-width, 0.3125rem) solid ${outline.color}`,
        boxShadow: 'var(--ai-toast-shadow, 0 0.625rem 0.9375rem -0.1875rem rgba(0,0,0,0.12), 0 0.25rem 0.375rem -0.125rem rgba(0,0,0,0.06))',
        minWidth: '17.5rem',
        maxWidth: '26.25rem',
        outline: 'none',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', padding: 'var(--ai-padding-lg, 0.75rem 1rem)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {item.title && <BaseToast.Title style={{ fontWeight: 'var(--ai-font-weight-semibold, 600)', fontSize: '0.9rem' }}>{item.title}</BaseToast.Title>}
              {item.sticky && !item.loading && (
                <span style={{ fontSize: '0.6875rem', padding: '0.0625rem 0.375rem', borderRadius: 'var(--ai-radius-sm, 0.25rem)', background: 'var(--ai-subtheme-error-bg)', color: 'var(--ai-subtheme-error-text)', fontWeight: 'var(--ai-font-weight-bold, 700)' }}>📌 Sticky</span>
              )}
            </div>
            <BaseToast.Description render={<div />} style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {item.loading && (
                <span aria-hidden="true" style={{ display: 'inline-flex' }}>
                  <Spinner size="sm" subtheme={item.type} />
                </span>
              )}
              {item.message}
            </BaseToast.Description>
          </div>
          <BaseToast.Close
            aria-label={strings.dismissToast}
            onClick={() => actions.dismissToast(item.id, 'user')}
            className="ai-btn"
            style={{ background: 'transparent', border: 'none', color: 'var(--ai-text-secondary, #6b7280)', cursor: 'pointer', fontSize: '1rem', padding: '0.125rem 0.375rem', ['--ai-btn-bg' as string]: 'transparent' }}
          >
            ×
          </BaseToast.Close>
        </div>
        {item.actions && item.actions.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            {item.actions.map((act, i) => (
              <button
                key={i}
                type="button"
                className="ai-btn"
                onClick={() => {
                  aiBus.emit('toast:action_clicked', { id: item.id, actionLabel: act.label, message: item.message });
                  act.onClick();
                  actions.dismissToast(item.id, 'action');
                }}
                style={{ padding: '0.25rem 0.625rem', borderRadius: 'var(--ai-radius-sm, 0.25rem)', border: `0.0625rem solid ${outline.color}`, background: 'transparent', color: outline.color, fontSize: '0.75rem', fontWeight: 'var(--ai-font-weight-semibold, 600)', cursor: 'pointer', ['--ai-btn-bg' as string]: 'transparent' }}
              >
                {act.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </BaseToast.Root>
  );
};
