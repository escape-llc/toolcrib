'use client';

// Tooltip on Base UI's Tooltip (#670, #700), a drop-in for the earlier
// implementation (same export, props, events and forwardRef). Portal container,
// stacked z-index, CSP nonce, enter/exit keyframes and the arrow come from the
// shared overlay layer (../Overlay/baseui/overlayLayer).
import React, { useId, useState, type HTMLAttributes, type ReactNode, type ReactElement } from 'react';
import { type StyleFree } from '../../theme/safeProps';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import { aiBus } from '../../eventBus/eventBus';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { TooltipThemeSlice, type TooltipSliceState } from './TooltipSlice';
import { ANCHORED_POP, OVERLAY_ARROW_CLASS, OverlayCSP, useOverlayAnimations, useOverlayArrowStyles, useOverlayLayer } from '../Overlay/baseui/overlayLayer';

/**
 * Props for the `<Tooltip>` hover/focus information overlay.
 *
 * Wraps the `children` element and shows a tooltip on hover/focus.
 * Emits `tooltip:shown` / `tooltip:hidden` events on the event bus.
 *
 * Anything beyond the tooltip's own props (event handlers, `aria-*`, a ref)
 * is forwarded to the trigger child, so a Tooltip composes inside another
 * component's trigger: a Popup/Modal/DropdownMenu whose trigger merges its
 * props and ref into the element it's given (Base UI's `render`) reaches the
 * real button through the Tooltip instead of stopping at it.
 */
export interface TooltipProps extends Omit<StyleFree<HTMLAttributes<HTMLElement>>, 'content' | 'children' | 'id'> {
  /** Unique identifier for event bus targeting. */
  id?: string;
  /** Text or ReactNode rendered inside the tooltip bubble. */
  content: ReactNode;
  /**
   * The element that triggers the tooltip on hover/focus. A single element
   * (not text or a Fragment) that becomes the trigger itself, with no
   * wrapper: it receives the trigger's props and ref, so it must forward
   * both to its DOM node. Every toolkit component (`Button`, `Input`, ...)
   * already does; a plain DOM element (`<span>`, `<div>`) always does too.
   */
  children: ReactElement;
  /**
   * Which side of the trigger the tooltip appears on.
   * @default 'top'
   */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * Alignment along the tooltip's side axis.
   * @default 'center'
   */
  align?: 'start' | 'center' | 'end';
  /**
   * Delay in milliseconds before the tooltip appears on hover.
   * @default 200
   */
  delayDuration?: number;
  /** Per-instance overrides for theme (dark/light/accent) and size. */
  overrides?: Partial<TooltipSliceState>;
}

/**
 * @manifest Hover/focus tooltip wrapping a child trigger element
 * @manifestCategory Overlays
 */
export const Tooltip = React.forwardRef<HTMLElement, TooltipProps>(({
  id,
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 200,
  overrides,
  'aria-describedby': consumerDescribedBy,
  ...triggerProps
}, ref) => {
  const { vars } = useSliceOverrides(TooltipThemeSlice, overrides);
  const { container, zIndex } = useOverlayLayer('TOOLTIP');
  useOverlayArrowStyles();
  useOverlayAnimations('toolcrib-tooltip-animations-baseui', [
    { className: 'ai-tooltip-content', ...ANCHORED_POP, timing: 'var(--ai-transition-duration-fast, 120ms) var(--ai-transition-easing, ease)' },
  ]);
  const [isOpen, setIsOpen] = useState(false);
  const popupId = useId();

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    aiBus.emit(open ? 'tooltip:shown' : 'tooltip:hidden', open ? { id, content: String(content) } : { id });
  };

  // Base UI's Tooltip sets no role="tooltip" and no aria-describedby (its
  // docs treat a tooltip as visual-only). This adds the description, so a
  // screen reader announces the tooltip text as the trigger's description.
  // The description only points at the popup while it's
  // mounted, and a consumer's own aria-describedby is kept alongside it.
  const describedBy = [consumerDescribedBy, isOpen ? popupId : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <OverlayCSP>
      {/* No Provider: each Tooltip keeps its own delay, with no
          skip-delay grouping between neighbours.
          disableHoverablePopup: the bubble is pointer-events: none anyway. */}
      <BaseTooltip.Root onOpenChange={handleOpenChange} disableHoverablePopup>
        {/* The child is the trigger (render), with no wrapper of its own, so a
            parent's alignItems: 'stretch' and a <UIGroup>'s direct-child
            corner squaring both reach it. Base UI merges the forwarded
            props' handlers with its own, and closes the tooltip on click
            (closeOnClick, on by default). */}
        <BaseTooltip.Trigger {...triggerProps} aria-describedby={describedBy} ref={ref as React.Ref<HTMLButtonElement>} render={children} delay={delayDuration} closeDelay={0} />
        <BaseTooltip.Portal container={container}>
          <BaseTooltip.Positioner side={side} align={align} sideOffset={5} style={{ zIndex }}>
            <BaseTooltip.Popup
              id={popupId}
              role="tooltip"
              className="ai-tooltip-content"
              style={{
                // Plain layout constant, like Modal's maxWidth: 90vw -- a long
                // content string wraps instead of running on as one line.
                maxWidth: '20rem',
                padding: 'var(--ai-tooltip-padding, 0.375rem 0.75rem)',
                fontSize: 'var(--ai-tooltip-font-size, 0.75rem)',
                fontWeight: 'var(--ai-font-weight-semibold, 600)',
                borderRadius: 'var(--ai-tooltip-border-radius, var(--ai-radius-md, 0.375rem))',
                background: 'var(--ai-tooltip-bg, var(--ai-text-primary, #111827))',
                color: 'var(--ai-tooltip-color, var(--ai-bg-surface, #ffffff))',
                boxShadow: 'var(--ai-shadow-sm, 0 0.25rem 0.75rem rgba(0,0,0,0.15))',
                userSelect: 'none',
                pointerEvents: 'none',
                // Not paint containment: it would clip the arrow (see
                // useOverlayArrowStyles).
                contain: 'layout style',
                ...vars,
              }}
            >
              {content}
              <BaseTooltip.Arrow
                className={OVERLAY_ARROW_CLASS}
                style={{ ['--ai-arrow-bg' as string]: 'var(--ai-tooltip-bg, var(--ai-text-primary, #111827))' }}
              />
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </OverlayCSP>
  );
});
Tooltip.displayName = 'Tooltip';
