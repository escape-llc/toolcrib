import React, { useEffect } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { ToastItem, useToast } from './ToastContext';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';

export interface ToastProps {
  toast: ToastItem;
}

export const ToastItemComponent: React.FC<ToastProps> = ({ toast }) => {
  const { dismissToast } = useToast();

  useEffect(() => {
    if (toast.sticky || !toast.duration || toast.duration <= 0) return;
    const timer = setTimeout(() => {
      aiBus.emit('toast:expired', {
        id: toast.id,
        message: toast.message,
        type: toast.type,
      });
      dismissToast(toast.id, 'expired');
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [toast.sticky, toast.duration, toast.id, toast.message, toast.type, dismissToast]);

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
      onOpenChange={(open) => {
        if (!open) dismissToast(toast.id, 'user');
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
        borderLeft: `0.3125rem solid ${getSubthemeColor(toast.type)}`,
        boxShadow: '0 0.625rem 0.9375rem -0.1875rem rgba(0,0,0,0.12), 0 0.25rem 0.375rem -0.125rem rgba(0,0,0,0.06)',
        minWidth: '17.5rem',
        maxWidth: '26.25rem',
        position: 'relative',
        zIndex: 3000,
        outline: 'none',
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
          onClick={() => dismissToast(toast.id, 'user')}
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
        {toasts.map(toast => (
          <div key={toast.id} style={{ pointerEvents: 'auto' }}>
            <ToastItemComponent toast={toast} />
          </div>
        ))}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Provider>
  );
};
