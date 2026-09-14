'use client';

import React, { useEffect, useState, type ReactNode, type ReactElement } from 'react';
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { useStackedZIndex } from '../../theme/zIndexStack';
import { AIErrorBoundary } from '../ErrorBoundary/AIErrorBoundary';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { useNonce } from '../../theme/nonceContext';
import { type SubthemeName } from '../../theme/subtheme';
import { Button } from '../Form/FormComponents';
import { AlertDialogThemeSlice, type AlertDialogSliceState } from './AlertDialogSlice';

const ALERTDIALOG_STYLE_ID = 'toolcrib-alertdialog-animations';

// Issue #408: identical bug shape to Modal.tsx (issue #373) -- see that
// component's own injectModalAnimations comment for the full diagnosis.
// Overlay/Content used to carry a static, unconditional inline `animation`
// string (entrance only) that's already finished by the time Radix flips
// data-state to "closed", so Radix's internal Presence (which
// AlertDialogPrimitive.Content/Overlay already use -- no `forceMount`
// needed) finds nothing running to wait for and tears the node down
// instantly. A real stylesheet keyed on [data-state="open"/"closed"]
// (same mechanism as Modal's/Tooltip's) gives Presence a fresh,
// genuinely-triggered animation on the way out too. Reuses the same
// shared ai-fade-in/-out and ai-scale-in/-out keyframes already injected
// by ThemeProvider -- no new keyframes needed. Not a `.ai-focus-ring`
// transition-shorthand collision (see Modal.tsx's identical note) --
// this uses `animation`, a separate property from the `transition`
// that bug is specific to.
function injectAlertDialogAnimations(targetDocument?: Document, nonce?: string): void {
  injectGlobalStyle(
    ALERTDIALOG_STYLE_ID,
    `
    .ai-alertdialog-overlay[data-state="open"] {
      animation: ai-fade-in var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease);
    }
    .ai-alertdialog-overlay[data-state="closed"] {
      animation: ai-fade-out var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease) forwards;
    }
    .ai-alertdialog-content[data-state="open"] {
      animation: ai-scale-in var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease);
    }
    .ai-alertdialog-content[data-state="closed"] {
      animation: ai-scale-out var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease) forwards;
    }
    `,
    targetDocument,
    nonce
  );
}

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
  const autoZIndex = useStackedZIndex('MODAL');
  const zIndex = zIndexProp ?? autoZIndex;
  const id = useStableId(propId, 'alertdialog');
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  useInjectInteractionStyles();
  useEffect(() => {
    injectAlertDialogAnimations(targetDocument, nonce);
  }, [targetDocument, nonce]);
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
          {/* aria-haspopup/aria-expanded explicitly nulled -- see
              Popup.tsx's identical wrapper for the full reasoning
              (role="button" here traded aria-allowed-attr for
              nested-interactive). */}
          <div aria-haspopup={undefined} aria-expanded={undefined} style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>{trigger}</div>
        </AlertDialogPrimitive.Trigger>
      )}

      <AlertDialogPrimitive.Portal container={targetDocument?.body}>
        <AlertDialogPrimitive.Overlay
          className="ai-alertdialog-overlay"
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
            ...alertDialogVars,
          }}
        >
          <AlertDialogPrimitive.Content
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
