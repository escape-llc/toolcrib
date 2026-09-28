'use client';

// Drawer on Base UI's Dialog (#670, #696). Base UI supplies what the earlier
// hand-rolled version lacked: a focus trap, scroll lock, focus return to the
// trigger, and Escape/outside-press dismissal that act on the right document
// (iframes, pop-outs). The panel keeps its four edge positions and slide
// keyframes. Base UI's own Drawer part (swipe-to-dismiss) is a possible
// follow-up; it drives motion differently and isn't needed for parity.
import React, { useState, type ReactNode, type ReactElement } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { AIErrorBoundary } from '../ErrorBoundary/AIErrorBoundary';
import { useStableId } from '../shared/useStableId';
import { OverlayCSP, triggerRenderProps, useOverlayAnimations, useOverlayLayer } from './baseui/overlayLayer';

const POSITIONS = ['top', 'right', 'bottom', 'left'] as const;
const DRAWER_TIMING = 'var(--ai-drawer-duration, 250ms) var(--ai-drawer-easing, ease)';
// Every position's keyframes in one stylesheet, so drawers on different
// edges share it instead of overwriting each other's.
const DRAWER_ANIMATIONS = [
  { className: 'ai-drawer-backdrop', enter: 'ai-fade-in', exit: 'ai-fade-out', timing: DRAWER_TIMING },
  ...POSITIONS.map(p => ({ className: `ai-drawer-panel-${p}`, enter: `ai-slide-in-${p}`, exit: `ai-slide-out-${p}`, timing: DRAWER_TIMING })),
];

/**
 * Props for the `<Drawer>` edge overlay.
 *
 * Opens from an edge of the viewport with a backdrop. Supports event bus control
 * via `aiBus.openDrawer(id)` / `aiBus.closeDrawer(id)`.
 */
export interface DrawerProps {
  /** Unique identifier for event bus targeting. Auto-generated if omitted. */
  id?: string;
  /**
   * Element that toggles the drawer on click.
   * It becomes the trigger itself, not a child of a wrapper: it receives the trigger's props, ARIA and ref, and focus returns to it on close, so it must be a native element or a component that forwards props and a ref to its DOM node (toolcrib's `<Button>` and `<Tooltip>` both do). A non-`<button>` native element gets `role="button"` and keyboard activation automatically.
   */
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
   * Z-index layer. Uses the toolkit's Z_INDEX.DRAWER tier by default. An
   * intentional escape hatch, not guarded against an arbitrary/conflicting
   * value -- most consumers should never need it. See Modal's identical
   * prop for the tie-breaking behavior when two instances share a default.
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
  zIndex: zIndexProp,
}) => {
  const id = useStableId(propId, 'drawer');
  const { container, zIndex } = useOverlayLayer('DRAWER', zIndexProp);
  useOverlayAnimations('toolcrib-drawer-animations', DRAWER_ANIMATIONS);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const toggle = (nextState: boolean, fromBus = false) => {
    if (nextState === isOpen && fromBus) return;
    if (externalIsOpen === undefined) setInternalIsOpen(nextState);
    onOpenChange?.(nextState);
    if (!fromBus) {
      if (nextState) aiBus.emit('drawer:shown', { id, position });
      else aiBus.emit('drawer:hidden', { id });
    }
  };

  useAIEvent('drawer:shown', e => {
    if (e.id === id) toggle(true, true);
  });
  useAIEvent('drawer:hidden', e => {
    if (e.id === id) toggle(false, true);
  });

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

  return (
    <OverlayCSP>
      <BaseDialog.Root open={isOpen} onOpenChange={open => toggle(open)}>
        {/* render, not a wrapper div: trigger semantics and focus return land
            on the consumer's own element (see Modal). */}
        {trigger && <BaseDialog.Trigger {...triggerRenderProps(trigger)} />}
        <BaseDialog.Portal container={container}>
          <BaseDialog.Backdrop
            // Test point (AGENTS.md: a data-testid over a guessed selector).
            data-testid="drawer-backdrop"
            className="ai-drawer-backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex,
              background: 'rgba(0, 0, 0, 0.4)',
              backdropFilter: 'blur(var(--ai-drawer-backdrop-blur, 0.125rem))',
            }}
          />
          <BaseDialog.Popup
            aria-modal="true"
            className={`ai-drawer-panel-${position}`}
            style={{
              position: 'fixed',
              background: 'var(--ai-bg-surface, #ffffff)',
              boxShadow: 'var(--ai-shadow-lg, 0 1.25rem 1.5625rem -0.3125rem rgba(0,0,0,0.15))',
              display: 'flex',
              flexDirection: 'column',
              zIndex: zIndex + 1,
              overflowY: 'auto',
              outline: 'none',
              // Self-contained drawer panel -- see Modal.tsx's identical
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
              <BaseDialog.Title
                style={{ margin: 0, fontWeight: 'var(--ai-font-weight-bold, 700)', fontSize: '1.125rem', color: 'var(--ai-text-primary, #111827)' }}
              >
                {title || 'Drawer Panel'}
              </BaseDialog.Title>
              <BaseDialog.Close
                aria-label="Close"
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
              </BaseDialog.Close>
            </div>

            <div style={{ padding: 'var(--ai-padding-lg, 1.25rem)', flex: 1, color: 'var(--ai-text-primary, #111827)' }}>
              <AIErrorBoundary componentName="Drawer">{children}</AIErrorBoundary>
            </div>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </OverlayCSP>
  );
};
