'use client';

import React, { useEffect, useRef, useState, type ReactNode, type ReactElement } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { Z_INDEX } from '../../theme/zIndex';
import { AIErrorBoundary } from '../ErrorBoundary/AIErrorBoundary';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { isDevBuild } from '../../theme/safeProps';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { useNonce } from '../../theme/nonceContext';
import { type SubthemeName } from '../../theme/subtheme';
import { TRIGGER_WRAPPER_STYLE } from '../../theme/triggerWrapperStyle';
import { computeCornerSquaring, renderTriggerWithCornerSquaring, renderAnchorWithCornerSquaring, useActualPopoverSide, type PopoverSide } from '../../theme/connectedPopoverStyles';
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
  /**
   * Trigger element -- both the popup's visual anchor point AND its
   * click/keyboard open control. Required unless `anchor` is given
   * instead (issue #502) -- the two are mutually exclusive.
   */
  trigger?: ReactElement;
  /**
   * A wider element the popup should anchor its POSITION to, separate
   * from what actually opens/closes it (issue #502) -- e.g. a date
   * field's whole bordered box, where only a small calendar-glyph button
   * inside it should toggle the popup, not the field's editable segments.
   * Mutually exclusive with `trigger`: place a `<Popup.Trigger>` around
   * the real clickable element somewhere inside `anchor`'s own children
   * instead. Corner-squaring (matching every other connected popover in
   * the toolkit) applies to `anchor`'s own edges in this mode, not the
   * nested trigger's.
   *
   * Must be a plain DOM element or a third-party component that forwards
   * a `style` prop straight through to its own root node (e.g. react-aria-
   * components' `Group`, DatePicker's own real usage) -- NOT a toolcrib
   * component. Every toolcrib component deliberately strips `style`/
   * `className` (see `ai-docs/CORE.md`'s "no component accepts style/
   * className" rule), so the corner-squaring this prop applies via a
   * cloned `style` would be silently dropped for one. A toolcrib
   * component that needs to anchor a `<Popup>` should consult
   * `useCornerSquaring`/expose its own `squareCorners` prop directly
   * instead of being passed here.
   */
  anchor?: ReactElement;
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
export const Popup: React.FC<PopupProps> & { Trigger: React.FC<{ children: ReactElement }> } = ({
  id: propId,
  trigger,
  anchor,
  children,
  placement = 'bottom-start',
  isOpen: externalIsOpen,
  onOpenChange,
  zIndex = Z_INDEX.DROPDOWN,
  overrides,
}) => {
  const id = useStableId(propId, 'popup');
  if (isDevBuild() && !anchor && !trigger) {
    console.error('<Popup>: either `trigger` or `anchor` is required.');
  }
  if (isDevBuild() && anchor && trigger) {
    console.error('<Popup>: `trigger` and `anchor` are mutually exclusive -- `trigger` is ignored when `anchor` is given. Place a <Popup.Trigger> around the real clickable element inside `anchor`\'s own children instead.');
  }
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
  // Issue #421: Radix's own default close-autofocus returns focus to
  // whatever it stored as "the trigger" -- but `asChild` (below) binds
  // that ref to the plain, non-focusable wrapper `<div>` around the real
  // trigger, not the real trigger itself (see that div's own comment on
  // why the wrapper exists at all). Focusing a non-focusable div is a
  // silent no-op in every real browser, so focus fell through to
  // <body> on every close -- confirmed directly (not assumed) against
  // the plain Popup demo, independent of any specific consumer like
  // DatePicker. A ref on the wrapper div itself (a real DOM node this
  // component already owns) lets onCloseAutoFocus below find and focus
  // the real interactive element actually nested inside it instead.
  const triggerWrapperRef = useRef<HTMLDivElement>(null);
  // Corner-squaring must key off the side Radix actually rendered, not
  // just the one requested -- Radix auto-flips on collision by default,
  // and nothing about the requested `side` changes when it does. See
  // useActualPopoverSide's own comment.
  const actualSide = useActualPopoverSide(contentRef, side, isOpen);
  const squaring = computeCornerSquaring(actualSide, align, isOpen);
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const renderedTrigger = renderTriggerWithCornerSquaring(trigger, squaring, uiGroupSquareCorners);
  // anchor mode (issue #502) skips the trigger-corner-squaring merge with
  // uiGroupSquareCorners entirely -- unlike a plain trigger, `anchor` is
  // authored by the CONSUMER (DatePicker's own <Group>), which already
  // applies its own useUIGroupSquareCorners() directly. Merging it again
  // here would be redundant (though harmless, since it's idempotent), not
  // wrong -- kept out to avoid Popup needing to know anything about the
  // anchor's own UIGroup membership at all.
  const renderedAnchor = renderAnchorWithCornerSquaring(anchor, squaring);

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={open => handleOpenChange(open)}>
      {anchor ? (
        // Real DOM nesting (Anchor wrapping Trigger, both real elements,
        // no virtualRef) -- deliberately NOT Radix's `virtualRef`
        // mechanism, which was tried first and reverted (see issue #502's
        // own history): `@radix-ui/react-popper`'s PopperAnchor only
        // registers a virtualRef from a plain, deferred `useEffect`,
        // landing after PopperContent's own (likely `useLayoutEffect`-
        // based) initial positioning -- empirically, the popup rendered
        // at viewport origin with zero-size CSS vars and never
        // recovered. A REAL anchored element sidesteps that whole class
        // of gap: Radix's Anchor picks it up the same way it would any
        // other real DOM node, with no separate registration timing to
        // race at all.
        <PopoverPrimitive.Anchor asChild>{renderedAnchor}</PopoverPrimitive.Anchor>
      ) : (
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
          <div ref={triggerWrapperRef} aria-haspopup={undefined} aria-expanded={undefined} style={TRIGGER_WRAPPER_STYLE}>{renderedTrigger}</div>
        </PopoverPrimitive.Trigger>
      )}

      <PopoverPrimitive.Portal container={targetDocument?.body}>
        <PopoverPrimitive.Content
          ref={contentRef}
          // Issue #421: overrides Radix's own default close-autofocus,
          // which targets the non-focusable wrapper div above (see
          // triggerWrapperRef's own comment) and silently fails. Finds
          // the real focusable trigger nested inside that same div instead.
          // preventDefault() stops Radix's own (broken) attempt from
          // running first and fighting this one.
          //
          // anchor mode (issue #502) skips this override entirely --
          // <Popup.Trigger> (below) wraps PopoverPrimitive.Trigger asChild
          // directly around the real clickable element, with NO
          // intermediate wrapper div the way legacy trigger mode always
          // inserts. Radix's own default close-autofocus behavior tracks
          // whatever real DOM node its Trigger's asChild ref resolved to
          // -- since that's the real button itself here (not a wrapper),
          // letting Radix's own default run is already correct, and
          // preventDefault()-ing it here (with nothing behind
          // triggerWrapperRef, which is never populated in this mode)
          // would only turn a working default into a silent no-op.
          onCloseAutoFocus={e => {
            if (anchor) return;
            e.preventDefault();
            triggerWrapperRef.current
              ?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
              ?.focus();
          }}
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

/**
 * Marks the real clickable element as this `<Popup>`'s open/close control,
 * for `anchor` mode (issue #502) -- placed anywhere inside `anchor`'s own
 * children, wherever the actual button/control lives. Works via Radix's
 * own Popover context, not any prop threaded down from `Popup` itself:
 * `PopoverPrimitive.Trigger` reads that context regardless of how deep in
 * the tree it's rendered, as long as it's a descendant of the same
 * `<PopoverPrimitive.Root>` -- which it always is here, since `anchor`
 * (containing this component somewhere in its own children) is rendered
 * by `Popup` itself, inside that same `Root`.
 *
 * Deliberately no wrapper `<div>` the way legacy trigger mode needs one
 * (see `TRIGGER_WRAPPER_STYLE`'s own comment on why that wrapper exists
 * there) -- `asChild` clones Radix's Trigger props directly onto
 * `children`, so the real button gets real interactive semantics
 * (aria-haspopup/aria-expanded/data-state) with nothing in between, which
 * is both simpler and more correct than legacy mode's own nulled-out
 * wrapper attributes.
 */
const PopupTrigger: React.FC<{ children: ReactElement }> = ({ children }) => (
  <PopoverPrimitive.Trigger asChild>{children}</PopoverPrimitive.Trigger>
);
PopupTrigger.displayName = 'Popup.Trigger';
Popup.Trigger = PopupTrigger;
