'use client';

// AlertDialog on Base UI's AlertDialog (#670, #696). Base UI's AlertDialog
// root hard-disables pointer dismissal, which is this component's whole
// contract: no light dismiss, Escape still cancels. Portal container,
// stacked z-index, CSP nonce and enter/exit keyframes come from the shared
// overlay layer (../Overlay/baseui/overlayLayer), as for Modal.
import React, { useState, type ReactNode, type ReactElement } from 'react';
import { AlertDialog as BaseAlertDialog } from '@base-ui/react/alert-dialog';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { AIErrorBoundary } from '../ErrorBoundary/AIErrorBoundary';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { type SubthemeName } from '../../theme/subtheme';
import { Button } from '../Form/FormComponents';
import { OverlayCSP, triggerRenderProps, useOverlayAnimations, useOverlayLayer } from '../Overlay/baseui/overlayLayer';
import { AlertDialogThemeSlice, type AlertDialogSliceState } from './AlertDialogSlice';

/**
 * Props for the `<AlertDialog>` blocking confirmation dialog.
 *
 * Slot sub-components: `AlertDialog.Header`, `AlertDialog.Body`,
 * `AlertDialog.Footer`, `AlertDialog.Actions`, `AlertDialog.Cancel`,
 * `AlertDialog.Action`.
 *
 * Unlike `<Modal>`, this cannot be dismissed by clicking outside it: Base
 * UI's AlertDialog root disables pointer dismissal and doesn't expose the
 * option. Escape still closes it, matching a native browser confirm
 * dialog's own Esc-to-cancel convention. Reserve this for interruptions
 * that require an explicit decision (e.g. "Delete this record?"), not
 * general-purpose content — use `<Modal>` for that.
 * AlertDialogs can be opened programmatically via `aiBus.openAlertDialog(id)`
 * without managing state.
 */
export interface AlertDialogProps {
  /** Unique identifier used for event bus targeting (e.g. `aiBus.openAlertDialog('confirm-delete')`). Auto-generated if omitted. */
  id?: string;
  /**
   * Element that opens the dialog on click; the dialog manages open/close state automatically.
   * It becomes the trigger itself, not a child of a wrapper: it receives the trigger's props, ARIA and ref, and focus returns to it on close, so it must be a native element or a component that forwards props and a ref to its DOM node (toolcrib's `<Button>` and `<Tooltip>` both do). A non-`<button>` native element gets `role="button"` and keyboard activation automatically.
   */
  trigger?: ReactElement;
  /** Slot content rendered inside the dialog. Use `AlertDialog.Header`, `AlertDialog.Body`, etc. */
  children: ReactNode;
  /** Controlled open state. When provided, the component becomes fully controlled. */
  isOpen?: boolean;
  /** Callback fired when the dialog opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Width of the dialog panel.
   * @default '25rem' (400px at 16px base)
   */
  width?: string;
  /**
   * Z-index layer. Uses the toolkit's Z_INDEX.MODAL tier by default. An
   * intentional escape hatch, not guarded against an arbitrary/conflicting
   * value -- most consumers should never need it. See Modal's identical
   * prop for the tie-breaking behavior when two instances share a default.
   * @default Z_INDEX.MODAL (200)
   */
  zIndex?: number;
  /**
   * Accessible name announced by screen readers when the dialog opens.
   * Always visually hidden, matching `Modal`'s `ariaLabel` — set this
   * explicitly (typically matching your `AlertDialog.Header` text) for a
   * meaningful announcement.
   * @default 'Confirm Action'
   */
  ariaLabel?: string;
  /** Per-instance overrides for backdrop blur and overlay darkness. */
  overrides?: Partial<AlertDialogSliceState> & { subtheme?: SubthemeName };
}

/**
 * @manifest Blocking confirmation dialog that cannot be light-dismissed — for destructive/irreversible actions
 * @manifestCategory Overlays
 */
export const AlertDialog: React.FC<AlertDialogProps> & {
  Header: React.FC<{ children: ReactNode }>;
  Body: React.FC<{ children: ReactNode }>;
  Footer: React.FC<{ children: ReactNode }>;
  Actions: React.FC<{ children: ReactNode }>;
  Cancel: React.FC<{ children?: ReactNode }>;
  Action: React.FC<{ children?: ReactNode; onClick?: () => void }>;
} = ({
  id: propId,
  trigger,
  children,
  isOpen: externalIsOpen,
  onOpenChange,
  width = '25rem',
  zIndex: zIndexProp,
  ariaLabel = 'Confirm Action',
  overrides,
}) => {
  const id = useStableId(propId, 'alertdialog');
  const { container, zIndex } = useOverlayLayer('MODAL', zIndexProp);
  useOverlayAnimations('toolcrib-alertdialog-animations', [
    { className: 'ai-alertdialog-overlay', enter: 'ai-fade-in', exit: 'ai-fade-out' },
    { className: 'ai-alertdialog-content', enter: 'ai-scale-in', exit: 'ai-scale-out' },
  ]);
  const { vars: alertDialogVars } = useSliceOverrides(AlertDialogThemeSlice, overrides);
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
        aiBus.emit('alertdialog:shown', { id });
      } else {
        aiBus.emit('alertdialog:hidden', { id });
      }
    }
  };

  useAIEvent('alertdialog:shown', e => {
    if (e.id === id && !isOpen) handleOpenChange(true, true);
  });

  useAIEvent('alertdialog:hidden', e => {
    if (e.id === id && isOpen) handleOpenChange(false, true);
  });

  return (
    <OverlayCSP>
      <BaseAlertDialog.Root open={isOpen} onOpenChange={open => handleOpenChange(open)}>
        {/* render, not a wrapper div: trigger semantics and focus return
            land on the consumer's own element (see Modal). */}
        {trigger && <BaseAlertDialog.Trigger {...triggerRenderProps(trigger)} />}
        <BaseAlertDialog.Portal container={container}>
          <BaseAlertDialog.Backdrop
            className="ai-alertdialog-overlay"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex,
              background: 'var(--ai-alertdialog-overlay-bg, rgba(0, 0, 0, 0.5))',
              backdropFilter: 'blur(var(--ai-alertdialog-backdrop-blur, 0.1875rem))',
              ...alertDialogVars,
            }}
          />
          <BaseAlertDialog.Viewport
            style={{
              position: 'fixed',
              inset: 0,
              zIndex,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--ai-padding-lg, 1.25rem)',
            }}
          >
            <BaseAlertDialog.Popup
              aria-modal="true"
              data-testid="alertdialog-container"
              className="ai-focus-ring ai-alertdialog-content"
              style={{
                background: 'var(--ai-bg-surface, #ffffff)',
                borderRadius: 'var(--ai-radius-lg, 0.75rem)',
                border: '0.0625rem solid var(--ai-border, #e5e7eb)',
                boxShadow: 'var(--ai-shadow-lg, 0 1.5625rem 3.125rem -0.75rem rgba(0, 0, 0, 0.3))',
                width,
                maxWidth: '90vw',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
                zIndex: zIndex + 1,
                outline: 'none',
                // See Modal.tsx: the same self-contained dialog-panel shape.
                contain: 'content',
              }}
            >
              <BaseAlertDialog.Title style={{ display: 'none' }}>{ariaLabel}</BaseAlertDialog.Title>
              <AIErrorBoundary componentName="AlertDialog">{children}</AIErrorBoundary>
            </BaseAlertDialog.Popup>
          </BaseAlertDialog.Viewport>
        </BaseAlertDialog.Portal>
      </BaseAlertDialog.Root>
    </OverlayCSP>
  );
};

AlertDialog.Header = ({ children }) => (
  <div
    style={{
      padding: 'var(--ai-padding-xl, 1rem 1.5rem)',
      borderBottom: '0.0625rem solid var(--ai-border, #e5e7eb)',
      fontWeight: 'var(--ai-font-weight-bold, 700)',
      fontSize: '1.125rem',
      color: 'var(--ai-text-primary, #111827)',
    }}
  >
    {children}
  </div>
);

AlertDialog.Body = ({ children }) => (
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

AlertDialog.Footer = ({ children }) => (
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

AlertDialog.Actions = ({ children }) => (
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

AlertDialog.Cancel = ({ children = 'Cancel' }) => (
  <BaseAlertDialog.Close render={<Button variant="outline" />}>{children}</BaseAlertDialog.Close>
);

// Close merges its own click handler with the Button's, so the consumer's
// onClick runs and the dialog closes. There's no separate "confirm" state:
// AlertDialog only closes on an explicit choice (Cancel, Action, Escape),
// never a timer or swipe.
AlertDialog.Action = ({ children = 'Confirm', onClick }) => (
  <BaseAlertDialog.Close render={<Button variant="danger" onClick={onClick} />}>{children}</BaseAlertDialog.Close>
);

AlertDialog.Header.displayName = 'AlertDialog.Header';
AlertDialog.Body.displayName = 'AlertDialog.Body';
AlertDialog.Footer.displayName = 'AlertDialog.Footer';
AlertDialog.Actions.displayName = 'AlertDialog.Actions';
AlertDialog.Cancel.displayName = 'AlertDialog.Cancel';
AlertDialog.Action.displayName = 'AlertDialog.Action';
