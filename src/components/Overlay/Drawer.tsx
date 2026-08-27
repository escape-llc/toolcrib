import React, { useState, useLayoutEffect, useRef, type ReactNode, type ReactElement } from 'react';
import { Portal } from 'radix-ui';
import { Presence } from '@radix-ui/react-presence';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { Z_INDEX } from '../../theme/zIndex';
import { AIErrorBoundary } from '../ErrorBoundary/AIErrorBoundary';
import { useStableId } from '../shared/useStableId';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { TRIGGER_WRAPPER_STYLE } from '../../theme/triggerWrapperStyle';

/**
 * Props for the `<Drawer>` edge overlay.
 *
 * Opens from an edge of the viewport with a backdrop. Supports event bus control
 * via `aiBus.openDrawer(id)` / `aiBus.closeDrawer(id)`.
 */
export interface DrawerProps {
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
  /** Title text rendered in the drawer header. @default 'Drawer Panel' */
  title?: ReactNode;
  /**
   * Width of the drawer panel (for left/right positions).
   * @default 'var(--ai-drawer-width, 23.75rem)'
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
export const Drawer: React.FC<DrawerProps> = ({
  id: propId,
  trigger,
  children,
  position = 'right',
  isOpen: externalIsOpen,
  onOpenChange,
  title,
  width: propWidth,
  zIndex = Z_INDEX.DRAWER,
}) => {
  const id = useStableId(propId, 'drawer');
  const targetDocument = useTargetDocument();
  useInjectInteractionStyles();
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const drawerRef = useRef<HTMLDivElement>(null);

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
        aiBus.emit('drawer:shown', { id, position });
      } else {
        aiBus.emit('drawer:hidden', { id });
      }
    }
  };

  useAIEvent('drawer:shown', e => {
    if (e.id === id) toggle(true, true);
  });
  useAIEvent('drawer:hidden', e => {
    if (e.id === id) toggle(false, true);
  });

  // useLayoutEffect, not useEffect — this listener must be attached
  // synchronously within the same commit as isOpen becoming true, not
  // deferred until after the browser paints (useEffect's own timing).
  // Reproduced directly: an Escape key dispatched with zero delay after
  // the click that opens this drawer was silently swallowed 100% of the
  // time (any wait ≥5ms worked fine) because the useEffect version hadn't
  // attached its listener yet — a real, if narrow, race for any fast
  // keyboard interaction, not just automated testing.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const doc = targetDocument ?? document;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        toggle(false);
      }
    };

    doc.addEventListener('keydown', handleKeyDown);
    return () => {
      doc.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetDocument]);

  const resolvedWidth = propWidth || 'var(--ai-drawer-width, 23.75rem)';

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

  // Keyed off the plain isOpen prop rather than derived "isClosing" state —
  // Presence (below) keeps this component rendering with isOpen already
  // false throughout the exit animation, so the fade-out/slide-out variant
  // is simply whatever isOpen currently says.
  const backdropAnim = isOpen
    ? 'ai-fade-in var(--ai-drawer-duration, 250ms) var(--ai-drawer-easing, ease) forwards'
    : 'ai-fade-out var(--ai-drawer-duration, 250ms) var(--ai-drawer-easing, ease) forwards';

  const drawerAnim = isOpen
    ? `ai-slide-in-${position} var(--ai-drawer-duration, 250ms) var(--ai-drawer-easing, ease) forwards`
    : `ai-slide-out-${position} var(--ai-drawer-duration, 250ms) var(--ai-drawer-easing, ease) forwards`;

  return (
    <>
      {trigger && (
        // TRIGGER_WRAPPER_STYLE's alignItems:'stretch' already stretches
        // trigger to fill this wrapper's height on its own — no need to
        // cloneElement-inject height/alignSelf into it directly.
        <div onClick={() => toggle()} style={TRIGGER_WRAPPER_STYLE}>
          {trigger}
        </div>
      )}
      <Portal.Root container={targetDocument?.body}>
        {/* Presence (Radix's own primitive, already used internally by
            Modal's Dialog) replaces the previous hand-rolled
            useAnimatedMount + onAnimationEnd combo. It attaches its
            animationend listener directly to this backdrop's real DOM
            node (via ref) rather than React's bubbling onAnimationEnd
            prop, and explicitly checks event.target === node itself --
            so it can't be fooled by a portaled-but-React-descendant
            Tooltip's own animationend bubbling through, which is exactly
            what broke the old hand-rolled version (a Tooltip inside this
            Drawer reusing the same 'ai-fade-out' keyframe name). */}
        <Presence present={isOpen}>
          <div
            role="presentation"
            onClick={() => toggle(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: zIndex,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(var(--ai-drawer-backdrop-blur, 0.125rem))',
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
                // Self-contained drawer panel — see Modal.tsx's identical
                // reasoning. Being position:'fixed' itself doesn't conflict with
                // also being a containment boundary for what's inside it.
                contain: 'content',
                ...getPositionStyles(),
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--ai-padding-lg, 1rem 1.25rem)',
                  margin: 'var(--ai-drawer-header-margin, 0)',
                  borderRadius: 'var(--ai-drawer-header-border-radius, 0)',
                  borderBottom: '0.0625rem solid var(--ai-border, #e5e7eb)',
                  background: 'var(--ai-bg-surface, #ffffff)',
                }}
              >
                <div style={{ fontWeight: 'var(--ai-font-weight-bold, 700)', fontSize: '1.125rem', color: 'var(--ai-text-primary, #111827)' }}>
                  {title || 'Drawer Panel'}
                </div>
                <button
                  onClick={() => toggle(false)}
                  className="ai-btn"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '1.25rem',
                    cursor: 'pointer',
                    color: 'var(--ai-text-secondary, #6b7280)',
                    ['--ai-btn-bg' as string]: 'transparent',
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ padding: 'var(--ai-padding-lg, 1.25rem)', flex: 1, color: 'var(--ai-text-primary, #111827)' }}>
                <AIErrorBoundary componentName="Drawer">
                  {children}
                </AIErrorBoundary>
              </div>
            </div>
          </div>
        </Presence>
      </Portal.Root>
    </>
  );
};
