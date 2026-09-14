'use client';

import React, { useEffect, useRef, useState, type ReactNode, type ReactElement } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { Z_INDEX } from '../../theme/zIndex';
import { AIErrorBoundary } from '../ErrorBoundary/AIErrorBoundary';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { useNonce } from '../../theme/nonceContext';
import { type SubthemeName } from '../../theme/subtheme';
import { TRIGGER_WRAPPER_STYLE } from '../../theme/triggerWrapperStyle';
import { computeCornerSquaring, renderTriggerWithCornerSquaring, useActualPopoverSide, type PopoverSide } from '../../theme/connectedPopoverStyles';
import { useUIGroupSquareCorners } from '../UIGroup/UIGroupContext';
import { PopupThemeSlice, type PopupSliceState } from './PopupSlice';

const POPUP_STYLE_ID = 'toolcrib-popup-animations';

// Issue #374: unlike Modal/AlertDialog (which at least had a broken
// entrance-only animation, see Modal.tsx's own injectModalAnimations
// comment for the full "slams shut" diagnosis), Popup.Content had NO
// animation at all -- open and close were both an instant, un-eased DOM
// swap, exactly the "transitions happen too fast to perceive" report.
// Radix's Popover.Content already uses Presence internally (no
// `forceMount` needed), so a real, [data-state]-conditioned stylesheet is
// all that's needed to give both directions genuine motion, the same
// mechanism Tooltip.tsx's own injectTooltipAnimations already established
// for this exact shape (a persisting node that needs a DIFFERENT animation
// on the way in vs. out, which a static inline `animation` string can't
// express). A plain fade, not a scale, deliberately matches Tooltip rather
// than Modal/AlertDialog's scale-in/-out -- Popup is architecturally the
// same "small anchored panel via Portal" shape as Tooltip (not a
// centered, full-attention dialog), and a fade reads as the more natural,
// less attention-grabbing motion for that role. Reuses the shared
// ai-fade-in/-out keyframes ThemeProvider already injects.
function injectPopupAnimations(targetDocument?: Document, nonce?: string): void {
  injectGlobalStyle(
    POPUP_STYLE_ID,
    `
    .ai-popup-content[data-state="open"] {
      animation: ai-fade-in var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease);
    }
    .ai-popup-content[data-state="closed"] {
      animation: ai-fade-out var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease) forwards;
    }
    `,
    targetDocument,
    nonce
  );
}

/** Determines which corner the popup content attaches to relative to the trigger. */
export type PopupPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';

/**
 * Props for the `<Popup>` anchored popover.
 *
 * Automatically handles trigger anchoring, light dismiss, and corner squaring
 * between trigger and popup panel. Supports event bus control.
 */
export interface PopupProps {
  /** Unique identifier for event bus targeting. Auto-generated if omitted. */
  id?: string;
  /** Required trigger element. The popup anchors to this element. */
  trigger: ReactElement;
  /** Content rendered inside the popup panel. */
  children: ReactNode;
  /**
   * Anchoring position relative to the trigger element.
   * @default 'bottom-start'
   */
  placement?: PopupPlacement;
  /** Controlled open state. When provided, the component becomes fully controlled. */
  isOpen?: boolean;
  /** Callback fired when the popup opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /**
   * Z-index layer. Uses the toolkit's Z_INDEX.DROPDOWN tier by default.
   * @default Z_INDEX.DROPDOWN (300)
   */
  zIndex?: number;
  /** Per-instance overrides for shadow depth and border style. */
  overrides?: Partial<PopupSliceState> & { subtheme?: SubthemeName };
}

/**
 * @manifest Anchored popover with light dismiss and corner-squaring to trigger
 * @manifestCategory Overlays
 */
export const Popup: React.FC<PopupProps> = ({
  id: propId,
  trigger,
  children,
  placement = 'bottom-start',
  isOpen: externalIsOpen,
  onOpenChange,
  zIndex = Z_INDEX.DROPDOWN,
  overrides,
}) => {
  const id = useStableId(propId, 'popup');
  const { vars: popupVars } = useSliceOverrides(PopupThemeSlice, overrides);
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  useInjectInteractionStyles();
  useEffect(() => {
    injectPopupAnimations(targetDocument, nonce);
  }, [targetDocument, nonce]);
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
        aiBus.emit('popup:shown', { id });
      } else {
        aiBus.emit('popup:hidden', { id });
      }
    }
  };

  useAIEvent('popup:shown', e => {
    if (e.id === id && !isOpen) handleOpenChange(true, true);
  });
  useAIEvent('popup:hidden', e => {
    if (e.id === id && isOpen) handleOpenChange(false, true);
  });

  // `placement` is `'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'`
  // -- exactly `${side}-${align}` for the two sides/aligns this prop has
  // always supported, so it maps directly onto the shared side/align form
  // every corner-squared trigger+popup pair in the toolkit now computes
  // from (see connectedPopoverStyles.ts).
  // Narrower than computeCornerSquaring's own PopoverAlign (which also
  // allows 'center'/'stretch' for other callers, e.g. Combobox) because
  // PopupPlacement itself only ever produces 'start'/'end' — keeping this
  // narrow lets `align` below go straight to Radix's own Content prop
  // (which only accepts 'start'|'center'|'end') with no cast.
  const [side, align] = placement.split('-') as [PopoverSide, 'start' | 'end'];
  const contentRef = useRef<HTMLDivElement>(null);
  // Corner-squaring must key off the side Radix actually rendered, not
  // just the one requested -- Radix auto-flips on collision by default,
  // and nothing about the requested `side` changes when it does. See
  // useActualPopoverSide's own comment.
  const actualSide = useActualPopoverSide(contentRef, side, isOpen);
  const squaring = computeCornerSquaring(actualSide, align, isOpen);
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const renderedTrigger = renderTriggerWithCornerSquaring(trigger, squaring, uiGroupSquareCorners);

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={open => handleOpenChange(open)}>
      <PopoverPrimitive.Trigger asChild>
        {/* TRIGGER_WRAPPER_STYLE, not a hand-typed inline-block — this
            component's own previous hand-typed copy used inline-block,
            which never stretches a child to fill its own box, so a Popup
            trigger nested inside a stretching flex parent (a <UIGroup>, a
            taller sibling in a row) stayed at its own shorter natural
            height instead of filling the space given to it — reported
            directly, and the reason this is now a shared constant instead
            of each component's own copy (see its own doc comment). */}
        {/* aria-haspopup/aria-expanded explicitly nulled -- Radix's
            `asChild` merges its own aria-haspopup/aria-expanded/data-state
            onto whichever element is its direct child, which is this
            wrapper div, not the real trigger element nested inside it.
            Tried giving the div role="button" first (its implicit
            "generic" role doesn't support aria-haspopup at all -- axe:
            aria-allowed-attr) -- that traded one violation for another
            (axe: nested-interactive, a "button" wrapping a real, separately
            focusable button). The real trigger inside already carries its
            own real interactive semantics and receives focus directly, so
            nulling these here doesn't lose anything an AT user actually
            had -- these attributes were never reaching the element that's
            actually focused either way. */}
        <div aria-haspopup={undefined} aria-expanded={undefined} style={TRIGGER_WRAPPER_STYLE}>{renderedTrigger}</div>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal container={targetDocument?.body}>
        <PopoverPrimitive.Content
          ref={contentRef}
          // Radix's Popover.Content hardcodes role="dialog" internally
          // (confirmed directly in its source), which needs an accessible
          // name axe's aria-dialog-name rule enforces -- but Popup is a
          // generic, non-modal, light-dismiss anchored container (no focus
          // trap, no forced modality), used for arbitrary content
          // (DatePicker's calendar, ThemeEditor's color picker, HoverCard,
          // Gallery) that's semantically nothing like an application
          // dialog. role="presentation" here is the identical fix already
          // applied to Combobox's own Popover wrapper for the same reason
          // -- overriding Radix's literal default, not adding a name to a
          // role that doesn't actually fit this component's real semantics.
          role="presentation"
          side={side}
          align={align}
          sideOffset={squaring.sideOffset}
          className="ai-focus-ring ai-popup-content"
          style={{
            zIndex,
            background: 'var(--ai-bg-surface, #ffffff)',
            border: 'var(--ai-popup-border, 0.0625rem solid var(--ai-border, #e5e7eb))',
            boxShadow: 'var(--ai-popup-shadow, 0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15))',
            padding: 'var(--ai-padding-lg, 0.75rem)',
            minWidth: '11.25rem',
            outline: 'none',
            // Self-contained floating panel — see Modal.tsx's identical
            // reasoning (this is already Radix-portaled to document.body,
            // so nothing inside needs to escape this box).
            contain: 'content',
            ...squaring.popupCornerStyle,
            ...popupVars,
          }}
        >
          <AIErrorBoundary componentName="Popup">
            {children}
          </AIErrorBoundary>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};
