'use client';

// SPIKE (#670, portals): Modal on Base UI's Dialog, a drop-in for the Radix
// version (same export, props and slots). Portal container, stacked z-index,
// CSP nonce and enter/exit keyframes come from the shared overlay layer
// (./baseui/overlayLayer). Base UI supplies the focus trap, scroll lock,
// outside-press and Escape dismissal, and native nested-dialog handling.
import React, { useState, type ReactNode, type ReactElement } from 'react';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { AIErrorBoundary } from '../ErrorBoundary/AIErrorBoundary';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { type SubthemeName } from '../../theme/subtheme';
import { Button } from '../Form/FormComponents';
import { ModalThemeSlice, type ModalSliceState } from './ModalSlice';
import { OverlayCSP, useOverlayAnimations, useOverlayLayer } from './baseui/overlayLayer';

/**
 * Props for the `<Modal>` dialog overlay.
 *
 * Slot sub-components: `Modal.Header`, `Modal.Body`, `Modal.Footer`, `Modal.Actions`, `Modal.CloseButton`.
 *
 * Modals can be opened programmatically via `aiBus.openModal(id)` without managing state.
 */
export interface ModalProps {
  /** Unique identifier used for event bus targeting (e.g. `aiBus.openModal('my-modal')`). Auto-generated if omitted. */
  id?: string;
  /** Element that opens the modal on click. Rendered inline; the modal manages open/close state automatically. */
  trigger?: ReactElement;
  /** Slot content rendered inside the modal dialog. Use `Modal.Header`, `Modal.Body`, etc. */
  children: ReactNode;
  /** Controlled open state. When provided, the component becomes fully controlled. */
  isOpen?: boolean;
  /** Callback fired when the modal opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Width of the modal dialog panel.
   * @default '31.25rem' (500px at 16px base)
   */
  width?: string;
  /**
   * Height of the modal dialog panel. Omit to size to content (the common
   * case) — set this for content that needs to fill a fixed amount of
   * space rather than shrink-to-fit, e.g. `<Viewer>`'s fullscreen-ish
   * lightbox.
   */
  height?: string;
  /**
   * Z-index layer. Uses the toolkit's Z_INDEX.MODAL tier by default. An
   * intentional escape hatch, not guarded against an arbitrary/conflicting
   * value -- most consumers should never need it. Two Modal instances left
   * at their shared default (nested, or simply both open) get the
   * identical numeric z-index; real stacking between them then falls back
   * to portal/DOM append order, which is what actually keeps a later-
   * opened instance on top today (verified live, see
   * e2e/zindex-stress.spec.ts) -- not a second, independent guarantee.
   * @default Z_INDEX.MODAL (200)
   */
  zIndex?: number;
  /**
   * Accessible name announced by screen readers when the dialog opens.
   * Always visually hidden — unlike `<Drawer title>`, which is a visible
   * `ReactNode` header, this is a screen-reader-only string. `Modal.Header`'s
   * visible text is decorative only and is not otherwise wired to the
   * dialog's accessible name, so set this explicitly (typically matching
   * your `Modal.Header` text) for a meaningful announcement.
   * @default 'Dialog'
   */
  ariaLabel?: string;
  /**
   * `'center'` (default) vertically centers the dialog, the standard
   * confirm/form-dialog placement. `'top'` anchors it near the top of the
   * viewport instead — a command palette or quick-switcher reads as a
   * lighter, keyboard-driven overlay there (VS Code's Ctrl/Cmd+K palette is
   * the reference point) rather than a dialog the user is expected to read
   * top-to-bottom and dismiss. Same focus trap, backdrop, and Escape-to-
   * close either way — only the position changes.
   * @default 'center'
   */
  align?: 'center' | 'top';
  /** Per-instance overrides for backdrop blur and overlay darkness. */
  overrides?: Partial<ModalSliceState> & { subtheme?: SubthemeName };
}

/**
 * @manifest Dialog overlay with focus trap, backdrop, and slot composition
 * @manifestCategory Overlays
 */
export const Modal: React.FC<ModalProps> & {
  Header: React.FC<{ children: ReactNode }>;
  Body: React.FC<{ children: ReactNode }>;
  Footer: React.FC<{ children: ReactNode }>;
  Actions: React.FC<{ children: ReactNode }>;
  CloseButton: React.FC<{ children?: ReactNode }>;
} = ({
  id: propId,
  trigger,
  children,
  isOpen: externalIsOpen,
  onOpenChange,
  width = '31.25rem',
  height,
  zIndex: zIndexProp,
  ariaLabel = 'Dialog',
  align = 'center',
  overrides,
}) => {
  const id = useStableId(propId, 'modal');
  const { container, zIndex } = useOverlayLayer('MODAL', zIndexProp);
  useOverlayAnimations('toolcrib-modal-animations-baseui', [
    { className: 'ai-modal-overlay', enter: 'ai-fade-in', exit: 'ai-fade-out' },
    { className: 'ai-modal-content', enter: 'ai-scale-in', exit: 'ai-scale-out' },
  ]);
  const { vars: modalVars } = useSliceOverrides(ModalThemeSlice, overrides);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const handleOpenChange = (open: boolean, fromBus = false) => {
    if (externalIsOpen === undefined) setInternalIsOpen(open);
    onOpenChange?.(open);
    if (!fromBus) aiBus.emit(open ? 'modal:shown' : 'modal:hidden', { id });
  };
  useAIEvent('modal:shown', e => {
    if (e.id === id && !isOpen) handleOpenChange(true, true);
  });
  useAIEvent('modal:hidden', e => {
    if (e.id === id && isOpen) handleOpenChange(false, true);
  });

  return (
    <OverlayCSP>
      <BaseDialog.Root open={isOpen} onOpenChange={open => handleOpenChange(open)}>
        {/* render, not a wrapper div: the dialog's trigger semantics
            (aria-haspopup/expanded, focus return on close) land on the
            consumer's own element. */}
        {trigger && <BaseDialog.Trigger render={trigger} />}
        <BaseDialog.Portal container={container}>
          <BaseDialog.Backdrop
            className="ai-modal-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex,
              background: 'var(--ai-modal-overlay-bg, rgba(0, 0, 0, 0.5))',
              backdropFilter: 'blur(var(--ai-modal-backdrop-blur, 0.1875rem))',
              ...modalVars,
            }}
          />
          <BaseDialog.Viewport
            style={{
              position: 'fixed',
              inset: 0,
              zIndex,
              display: 'flex',
              alignItems: align === 'top' ? 'flex-start' : 'center',
              justifyContent: 'center',
              padding: 'var(--ai-padding-lg, 1.25rem)',
              paddingTop: align === 'top' ? '10vh' : 'var(--ai-padding-lg, 1.25rem)',
            }}
          >
            <BaseDialog.Popup
              aria-modal="true"
              data-testid="modal-container"
              className="ai-focus-ring ai-modal-content"
              style={{
                background: 'var(--ai-bg-surface, #ffffff)',
                borderRadius: 'var(--ai-radius-lg, 0.75rem)',
                border: '0.0625rem solid var(--ai-border, #e5e7eb)',
                boxShadow: 'var(--ai-shadow-lg, 0 1.5625rem 3.125rem -0.75rem rgba(0, 0, 0, 0.3))',
                width,
                height,
                maxWidth: '90vw',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
                zIndex: zIndex + 1,
                outline: 'none',
                contain: 'content',
              }}
            >
              <BaseDialog.Title style={{ display: 'none' }}>{ariaLabel}</BaseDialog.Title>
              <AIErrorBoundary componentName="Modal">{children}</AIErrorBoundary>
            </BaseDialog.Popup>
          </BaseDialog.Viewport>
        </BaseDialog.Portal>
      </BaseDialog.Root>
    </OverlayCSP>
  );
};

Modal.Header = ({ children }) => (
  <div
    style={{
      padding: 'var(--ai-padding-xl, 1rem 1.5rem)',
      borderBottom: '0.0625rem solid var(--ai-border, #e5e7eb)',
      fontWeight: 'var(--ai-font-weight-bold, 700)',
      fontSize: '1.25rem',
      color: 'var(--ai-text-primary, #111827)',
    }}
  >
    {children}
  </div>
);

Modal.Body = ({ children }) => (
  <div
    style={{
      padding: 'var(--ai-padding-xl, 1.5rem)',
      overflowY: 'auto',
      color: 'var(--ai-text-primary, #111827)',
      fontSize: '0.875rem',
      flex: 1,
      minHeight: 0,
    }}
  >
    {children}
  </div>
);

Modal.Footer = ({ children }) => (
  <div
    style={{
      padding: 'var(--ai-padding-xl, 1rem 1.5rem)',
      borderTop: '0.0625rem solid var(--ai-border, #e5e7eb)',
      background: 'var(--ai-bg-container, #f9fafb)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}
  >
    {children}
  </div>
);

Modal.Actions = ({ children }) => (
  <div
    style={{
      display: 'flex',
      gap: '0.625rem',
      alignItems: 'center',
      justifyContent: 'flex-end',
    }}
  >
    {children}
  </div>
);

Modal.CloseButton = ({ children = 'Close' }) => (
  <BaseDialog.Close render={<Button variant="outline" />}>{children}</BaseDialog.Close>
);

Modal.Header.displayName = 'Modal.Header';
Modal.Body.displayName = 'Modal.Body';
Modal.Footer.displayName = 'Modal.Footer';
Modal.Actions.displayName = 'Modal.Actions';
Modal.CloseButton.displayName = 'Modal.CloseButton';
