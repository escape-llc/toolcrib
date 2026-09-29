'use client';

// Popup on Base UI's Popover (#670, #696), a drop-in for the earlier Radix
// version (same export, props, Popup.Trigger slot and anchor mode). Portal
// container, stacked z-index, CSP nonce and enter/exit keyframes come from the
// shared overlay layer (./baseui/overlayLayer).
//
// What Base UI removes: the Radix version wrapped the trigger in a <div> so
// asChild had somewhere to put its props, then nulled that div's ARIA
// attributes and hand-rolled focus return to the real button nested inside
// (#421). Base UI's render prop puts the trigger semantics on the consumer's
// own element, so focus return is the default and the wrapper is gone.
import React, { useRef, useState, type ReactNode, type ReactElement } from 'react';
import { Popover as BasePopover } from '@base-ui/react/popover';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { useOwnEmit } from '../../eventBus/useOwnEmit';
import { AIErrorBoundary } from '../ErrorBoundary/AIErrorBoundary';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { isDevBuild } from '../../theme/safeProps';
import { type SubthemeName } from '../../theme/subtheme';
import { computeCornerSquaring, renderTriggerWithCornerSquaring, renderAnchorWithCornerSquaring, useActualPopoverSide, type PopoverSide } from '../../theme/connectedPopoverStyles';
import { useUIGroupSquareCorners } from '../UIGroup/UIGroupContext';
import { PopupThemeSlice, type PopupSliceState } from './PopupSlice';
import { OverlayCSP, triggerRenderProps, useOverlayAnimations, useOverlayLayer } from './baseui/overlayLayer';

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
   * It becomes the trigger itself, not a child of a wrapper: it receives the trigger's props, ARIA and ref, and focus returns to it on close, so it must be a native element or a component that forwards props and a ref to its DOM node (toolcrib's `<Button>` and `<Tooltip>` both do). A non-`<button>` native element gets `role="button"` and keyboard activation automatically.
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
  zIndex: zIndexProp,
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
  const { container, zIndex } = useOverlayLayer('DROPDOWN', zIndexProp);
  useOverlayAnimations('toolcrib-popup-animations-baseui', [{ className: 'ai-popup-content', enter: 'ai-fade-in', exit: 'ai-fade-out' }]);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  // Own emissions are marked so the listeners below skip their echo (#705).
  const { emitOwn, isOwnEcho } = useOwnEmit();
  const handleOpenChange = (open: boolean, fromBus = false) => {
    if (externalIsOpen === undefined) setInternalIsOpen(open);
    onOpenChange?.(open);
    if (!fromBus) emitOwn(() => aiBus.emit(open ? 'popup:shown' : 'popup:hidden', { id }));
  };
  useAIEvent('popup:shown', e => {
    if (e.id === id && !isOpen && !isOwnEcho()) handleOpenChange(true, true);
  });
  useAIEvent('popup:hidden', e => {
    if (e.id === id && isOpen && !isOwnEcho()) handleOpenChange(false, true);
  });

  const [side, align] = placement.split('-') as [PopoverSide, 'start' | 'end'];
  const contentRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLElement>(null);
  // Base UI's popup carries data-side like Radix's, so the collision-aware
  // corner squaring works unchanged.
  const actualSide = useActualPopoverSide(contentRef, side, isOpen);
  const squaring = computeCornerSquaring(actualSide, align, isOpen);
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const renderedTrigger = renderTriggerWithCornerSquaring(trigger, squaring, uiGroupSquareCorners);
  const renderedAnchor = anchor ? React.cloneElement(renderAnchorWithCornerSquaring(anchor, squaring) as ReactElement<{ ref?: unknown }>, { ref: anchorRef }) : null;

  return (
    <OverlayCSP>
      <BasePopover.Root open={isOpen} onOpenChange={open => handleOpenChange(open)}>
        {anchor ? renderedAnchor : renderedTrigger && <BasePopover.Trigger {...triggerRenderProps(renderedTrigger as ReactElement)} />}
        <BasePopover.Portal container={container}>
          <BasePopover.Positioner side={side} align={align} sideOffset={squaring.sideOffset} anchor={anchor ? anchorRef : undefined} style={{ zIndex }}>
            {/* role="presentation": Popup is a generic non-modal container
                (DatePicker's calendar, ThemeEditor's color picker, HoverCard,
                Gallery), not an application dialog -- the same override the
                Radix version applied to its hard-coded role="dialog". */}
            <BasePopover.Popup
              ref={contentRef}
              role="presentation"
              className="ai-focus-ring ai-popup-content"
              style={{
                background: 'var(--ai-bg-surface, #ffffff)',
                border: 'var(--ai-popup-border, 0.0625rem solid var(--ai-border, #e5e7eb))',
                boxShadow: 'var(--ai-popup-shadow, 0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15))',
                padding: 'var(--ai-padding-lg, 0.75rem)',
                minWidth: '11.25rem',
                outline: 'none',
                contain: 'content',
                ...squaring.popupCornerStyle,
                ...popupVars,
              }}
            >
              <AIErrorBoundary componentName="Popup">{children}</AIErrorBoundary>
            </BasePopover.Popup>
          </BasePopover.Positioner>
        </BasePopover.Portal>
      </BasePopover.Root>
    </OverlayCSP>
  );
};

/**
 * Marks the real clickable element as this `<Popup>`'s open/close control,
 * for `anchor` mode (issue #502) -- placed anywhere inside `anchor`'s own
 * children. Base UI's Trigger reads the Popover context wherever it sits, and
 * render puts its props on the consumer's element directly.
 */
const PopupTrigger: React.FC<{ children: ReactElement }> = ({ children }) => <BasePopover.Trigger {...triggerRenderProps(children)} />;
PopupTrigger.displayName = 'Popup.Trigger';
Popup.Trigger = PopupTrigger;
