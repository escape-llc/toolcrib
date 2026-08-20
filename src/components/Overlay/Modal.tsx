import React, { useState, type ReactNode, type ReactElement } from 'react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { Z_INDEX } from '../../theme/zIndex';
import { AIErrorBoundary } from '../ErrorBoundary/AIErrorBoundary';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { type SubthemeName } from '../../theme/subtheme';
import { TRIGGER_WRAPPER_STYLE } from '../../theme/triggerWrapperStyle';
import { Button } from '../Form/FormComponents';
import { ModalThemeSlice, type ModalSliceState } from './ModalSlice';

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
   * Z-index layer. Uses the toolkit's Z_INDEX.MODAL tier by default.
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
  zIndex = Z_INDEX.MODAL,
  ariaLabel = 'Dialog',
  overrides,
}) => {
  const id = useStableId(propId, 'modal');
  const targetDocument = useTargetDocument();
  useInjectInteractionStyles();
  const { vars: modalVars } = useSliceOverrides(ModalThemeSlice, overrides);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const handleOpenChange = (open: boolean, fromBus = false) => {
    if (externalIsOpen === undefined) {
      setInternalIsOpen(open);
    }
    if (onOpenChange) {
      onOpenChange(open);
    }
    if (!fromBus) {
      if (open) {
        aiBus.emit('modal:shown', { id });
      } else {
        aiBus.emit('modal:hidden', { id });
      }
    }
  };

  useAIEvent('modal:shown', e => {
    if (e.id === id && !isOpen) handleOpenChange(true, true);
  });

  useAIEvent('modal:hidden', e => {
    if (e.id === id && isOpen) handleOpenChange(false, true);
  });

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={open => handleOpenChange(open)}>
      {trigger && (
        <DialogPrimitive.Trigger asChild>
          <div style={TRIGGER_WRAPPER_STYLE}>{trigger}</div>
        </DialogPrimitive.Trigger>
      )}

      <DialogPrimitive.Portal container={targetDocument?.body}>
        <DialogPrimitive.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: zIndex,
            background: 'var(--ai-modal-overlay-bg, rgba(0, 0, 0, 0.5))',
            backdropFilter: 'blur(var(--ai-modal-backdrop-blur, 0.1875rem))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--ai-padding-lg, 1.25rem)',
            animation: 'ai-fade-in var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease)',
            ...modalVars,
          }}
        >
          <DialogPrimitive.Content
            aria-describedby={undefined}
            data-testid="modal-container"
            className="ai-focus-ring"
            style={{
              background: 'var(--ai-bg-surface, #ffffff)',
              borderRadius: 'var(--ai-radius-lg, 0.75rem)',
              border: '0.0625rem solid var(--ai-border, #e5e7eb)',
              boxShadow: '0 1.5625rem 3.125rem -0.75rem rgba(0, 0, 0, 0.3)',
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
              animation: 'ai-scale-in var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease)',
              // A self-contained dialog panel: its own children's layout/
              // paint never needs to affect the rest of the page, and
              // nothing inside relies on escaping this box (any further
              // dropdown/tooltip opened from inside a Modal renders through
              // its own Radix Portal, off document.body — unaffected by
              // this being a new containing block).
              contain: 'content',
            }}
          >
            <DialogPrimitive.Title style={{ display: 'none' }}>{ariaLabel}</DialogPrimitive.Title>
            <AIErrorBoundary componentName="Modal">
              {children}
            </AIErrorBoundary>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
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

Modal.CloseButton = ({ children = 'Close' }) => {
  return (
    <DialogPrimitive.Close asChild>
      <Button variant="outline">{children}</Button>
    </DialogPrimitive.Close>
  );
};

Modal.Header.displayName = 'Modal.Header';
Modal.Body.displayName = 'Modal.Body';
Modal.Footer.displayName = 'Modal.Footer';
Modal.Actions.displayName = 'Modal.Actions';
Modal.CloseButton.displayName = 'Modal.CloseButton';
