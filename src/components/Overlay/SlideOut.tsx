import React, { useState, useEffect, useRef, ReactNode, ReactElement } from 'react';
import { Portal } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { Z_INDEX } from '../../theme/zIndex';
import { AIErrorBoundary } from '../ErrorBoundary/AIErrorBoundary';

/**
 * Props for the `<SlideOut>` drawer overlay.
 *
 * Opens from an edge of the viewport with a backdrop. Supports event bus control
 * via `aiBus.openSlideOut(id)` / `aiBus.closeSlideOut(id)`.
 */
export interface SlideOutProps {
  /** Unique identifier for event bus targeting. Auto-generated if omitted. */
  id?: string;
  /** Element that toggles the drawer on click. Rendered inline. */
  trigger?: ReactElement;
  /** Content rendered inside the drawer panel body. */
  children: ReactNode;
  /**
   * Which viewport edge the drawer slides in from.
   * @default 'right'
   */
  position?: 'top' | 'right' | 'bottom' | 'left';
  /** Controlled open state. When provided, the component becomes fully controlled. */
  isOpen?: boolean;
  /** Callback fired when the drawer opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** Title text rendered in the drawer header. @default 'Slide Out Panel' */
  title?: ReactNode;
  /**
   * Width of the drawer panel (for left/right positions).
   * @default 'var(--ai-slideout-width, 23.75rem)'
   */
  width?: string;
  /**
   * Z-index layer. Uses the toolkit's Z_INDEX.DRAWER tier by default.
   * @default Z_INDEX.DRAWER (100)
   */
  zIndex?: number;
}

/**
 * @manifest Edge drawer overlay with backdrop blur and slide animation
 * @manifestCategory Overlays
 */
export const SlideOut: React.FC<SlideOutProps> = ({
  id = `slideout-${Math.random().toString(36).substring(2, 7)}`,
  trigger,
  children,
  position = 'right',
  isOpen: externalIsOpen,
  onOpenChange,
  title,
  width: propWidth,
  zIndex = Z_INDEX.DRAWER,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const drawerRef = useRef<HTMLDivElement>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isOpen) {
      setIsMounted(true);
      setIsClosing(false);
    } else if (isMounted) {
      setIsClosing(true);
      timer = setTimeout(() => {
        setIsMounted(false);
        setIsClosing(false);
      }, 250);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen]);

  const toggle = (state?: boolean, fromBus = false) => {
    const nextState = state !== undefined ? state : !isOpen;
    if (nextState === isOpen && fromBus) return;

    if (externalIsOpen === undefined) {
      setInternalIsOpen(nextState);
    }
    if (onOpenChange) {
      onOpenChange(nextState);
    }
    if (!fromBus) {
      if (nextState) {
        aiBus.emit('slideout:shown', { id, position });
      } else {
        aiBus.emit('slideout:hidden', { id });
      }
    }
  };

  useAIEvent('slideout:shown', e => {
    if (e.id === id) toggle(true, true);
  });
  useAIEvent('slideout:hidden', e => {
    if (e.id === id) toggle(false, true);
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        toggle(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const resolvedWidth = propWidth || 'var(--ai-slideout-width, 23.75rem)';

  const getPositionStyles = (): React.CSSProperties => {
    const r = 'var(--ai-radius-lg, 0.75rem)';
    switch (position) {
      case 'left':
        return { top: 0, left: 0, bottom: 0, width: resolvedWidth, height: '100vh', borderTopRightRadius: r, borderBottomRightRadius: r };
      case 'top':
        return { top: 0, left: 0, right: 0, height: '20rem', width: '100vw', borderBottomLeftRadius: r, borderBottomRightRadius: r };
      case 'bottom':
        return { bottom: 0, left: 0, right: 0, height: '20rem', width: '100vw', borderTopLeftRadius: r, borderTopRightRadius: r };
      case 'right':
      default:
        return { top: 0, right: 0, bottom: 0, width: resolvedWidth, height: '100vh', borderTopLeftRadius: r, borderBottomLeftRadius: r };
    }
  };

  const backdropAnim = isClosing
    ? 'ai-fade-out var(--ai-slideout-duration, 250ms) var(--ai-slideout-easing, ease) forwards'
    : 'ai-fade-in var(--ai-slideout-duration, 250ms) var(--ai-slideout-easing, ease) forwards';

  const drawerAnim = isClosing
    ? `ai-slide-out-${position} var(--ai-slideout-duration, 250ms) var(--ai-slideout-easing, ease) forwards`
    : `ai-slide-in-${position} var(--ai-slideout-duration, 250ms) var(--ai-slideout-easing, ease) forwards`;

  const portalContent = isMounted && (
    <div
      role="presentation"
      onClick={() => toggle(false)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex,
        background: 'rgba(0, 0, 0, 0.4)',
        backdropFilter: 'blur(var(--ai-slideout-backdrop-blur, 0.125rem))',
        display: 'flex',
        animation: backdropAnim,
      }}
    >
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          background: 'var(--ai-bg-surface, #ffffff)',
          boxShadow: '0 1.25rem 1.5625rem -0.3125rem rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: zIndex + 1,
          overflowY: 'auto',
          animation: drawerAnim,
          ...getPositionStyles(),
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            margin: 'var(--ai-slideout-header-margin, 0)',
            borderRadius: 'var(--ai-slideout-header-border-radius, 0)',
            borderBottom: '0.0625rem solid var(--ai-border, #e5e7eb)',
            background: 'var(--ai-bg-surface, #ffffff)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--ai-text-primary, #111827)' }}>
            {title || 'Slide Out Panel'}
          </div>
          <button
            onClick={() => toggle(false)}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: 'var(--ai-text-secondary, #6b7280)',
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '1.25rem', flex: 1, color: 'var(--ai-text-primary, #111827)' }}>
          <AIErrorBoundary componentName="SlideOut">
            {children}
          </AIErrorBoundary>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {trigger && (
        // alignItems:'stretch' (the flexbox default) already stretches
        // trigger to fill this wrapper's height on its own — no need to
        // cloneElement-inject height/alignSelf into it directly.
        <div onClick={() => toggle()} style={{ display: 'inline-flex', alignItems: 'stretch', cursor: 'pointer' }}>
          {trigger}
        </div>
      )}
      {isMounted && <Portal.Root>{portalContent}</Portal.Root>}
    </>
  );
};
