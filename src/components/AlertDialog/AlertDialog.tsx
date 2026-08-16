import React, { useState, ReactNode, ReactElement } from 'react';
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { Z_INDEX } from '../../theme/zIndex';
import { AIErrorBoundary } from '../ErrorBoundary/AIErrorBoundary';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { SubthemeName } from '../../theme/subtheme';
import { Button } from '../Form/FormComponents';
import { AlertDialogThemeSlice, AlertDialogSliceState } from './AlertDialogSlice';

/**
 * Props for the `<AlertDialog>` blocking confirmation dialog.
 *
 * Slot sub-components: `AlertDialog.Header`, `AlertDialog.Body`,
 * `AlertDialog.Footer`, `AlertDialog.Actions`, `AlertDialog.Cancel`,
 * `AlertDialog.Action`.
 *
 * Unlike `<Modal>`, this cannot be dismissed by clicking outside it —
 * Radix's `AlertDialog.Content` prevents `onPointerDownOutside`/
 * `onInteractOutside` by default, confirmed directly in
 * `@radix-ui/react-alert-dialog`'s source, not assumed. Escape still closes
 * it (that path isn't overridden), matching a native browser confirm
 * dialog's own Esc-to-cancel convention. Reserve this for interruptions
 * that require an explicit decision (e.g. "Delete this record?"), not
 * general-purpose content — use `<Modal>` for that.
 * AlertDialogs can be opened programmatically via `aiBus.openAlertDialog(id)`
 * without managing state.
 */
export interface AlertDialogProps {
  /** Unique identifier used for event bus targeting (e.g. `aiBus.openAlertDialog('confirm-delete')`). Auto-generated if omitted. */
  id?: string;
  /** Element that opens the dialog on click. Rendered inline; the dialog manages open/close state automatically. */
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
   * Z-index layer. Uses the toolkit's Z_INDEX.MODAL tier by default.
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
  zIndex = Z_INDEX.MODAL,
  ariaLabel = 'Confirm Action',
  overrides,
}) => {
  const id = useStableId(propId, 'alertdialog');
  const targetDocument = useTargetDocument();
  useInjectInteractionStyles();
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
    <AlertDialogPrimitive.Root open={isOpen} onOpenChange={open => handleOpenChange(open)}>
      {trigger && (
        <AlertDialogPrimitive.Trigger asChild>
          <div style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>{trigger}</div>
        </AlertDialogPrimitive.Trigger>
      )}

      <AlertDialogPrimitive.Portal container={targetDocument?.body}>
        <AlertDialogPrimitive.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: zIndex,
            background: 'var(--ai-alertdialog-overlay-bg, rgba(0, 0, 0, 0.5))',
            backdropFilter: 'blur(var(--ai-alertdialog-backdrop-blur, 0.1875rem))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--ai-padding-lg, 1.25rem)',
            animation: 'ai-fade-in var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease)',
            ...alertDialogVars,
          }}
        >
          <AlertDialogPrimitive.Content
            data-testid="alertdialog-container"
            className="ai-focus-ring"
            style={{
              background: 'var(--ai-bg-surface, #ffffff)',
              borderRadius: 'var(--ai-radius-lg, 0.75rem)',
              border: '0.0625rem solid var(--ai-border, #e5e7eb)',
              boxShadow: '0 1.5625rem 3.125rem -0.75rem rgba(0, 0, 0, 0.3)',
              width,
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
              zIndex: zIndex + 1,
              outline: 'none',
              animation: 'ai-scale-in var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease)',
              // See Modal.tsx's identical comment — same self-contained
              // dialog-panel shape.
              contain: 'content',
            }}
          >
            <AlertDialogPrimitive.Title style={{ display: 'none' }}>{ariaLabel}</AlertDialogPrimitive.Title>
            <AIErrorBoundary componentName="AlertDialog">
              {children}
            </AIErrorBoundary>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Overlay>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
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
  <AlertDialogPrimitive.Cancel asChild>
    <Button variant="outline">{children}</Button>
  </AlertDialogPrimitive.Cancel>
);

// Radix's AlertDialogPrimitive.Action closes the dialog on click once its
// own (and any consumer-supplied) onClick handler finishes synchronously —
// there's no separate "confirm" state to manage here, unlike Toast's close
// paths, since AlertDialog only ever closes via an explicit user choice
// (Cancel or Action), never a timer or swipe.
AlertDialog.Action = ({ children = 'Confirm', onClick }) => (
  <AlertDialogPrimitive.Action asChild>
    <Button variant="danger" onClick={onClick}>{children}</Button>
  </AlertDialogPrimitive.Action>
);

AlertDialog.Header.displayName = 'AlertDialog.Header';
AlertDialog.Body.displayName = 'AlertDialog.Body';
AlertDialog.Footer.displayName = 'AlertDialog.Footer';
AlertDialog.Actions.displayName = 'AlertDialog.Actions';
AlertDialog.Cancel.displayName = 'AlertDialog.Cancel';
AlertDialog.Action.displayName = 'AlertDialog.Action';
