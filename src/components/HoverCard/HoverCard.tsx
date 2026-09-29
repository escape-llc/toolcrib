'use client';

// HoverCard on Base UI's PreviewCard (#670, #700), a drop-in for the earlier
// Radix version (same export, props and events). Portal container, stacked
// z-index, CSP nonce, enter/exit keyframes and the arrow come from the shared
// overlay layer (../Overlay/baseui/overlayLayer).
import React, { type ReactNode, type ReactElement } from 'react';
import { PreviewCard } from '@base-ui/react/preview-card';
import { aiBus } from '../../eventBus/eventBus';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { AIErrorBoundary } from '../ErrorBoundary/AIErrorBoundary';
import { HoverCardThemeSlice, type HoverCardSliceState } from './HoverCardSlice';
import { OVERLAY_ARROW_CLASS, OverlayCSP, useOverlayAnimations, useOverlayArrowStyles, useOverlayLayer } from '../Overlay/baseui/overlayLayer';

const BORDER = 'var(--ai-hovercard-border, 0.0625rem solid var(--ai-border, #e5e7eb))';

/**
 * Props for the `<HoverCard>` hover-triggered preview card.
 *
 * Unlike `<Tooltip>`, `content` may hold rich, interactive markup (a link,
 * an avatar + bio, a button) — the card doesn't disappear on pointer-down
 * the way Tooltip deliberately does, so a *mouse* click inside it reaches
 * its target normally.
 *
 * **Supplemental, not keyboard-operable.** The card opens when its trigger
 * gets keyboard focus, so its content is announced, but Tab from the trigger
 * moves on through the page rather than into the card. Use `<Popup>` when
 * the content's buttons or links need to be keyboard-reachable.
 */
export interface HoverCardProps {
  /** Unique identifier for event bus targeting. */
  id?: string;
  /** Rich content shown inside the card. */
  content: ReactNode;
  /**
   * The element that triggers the card on hover/focus. A single element that
   * becomes the trigger itself, with no wrapper: it receives the trigger's
   * props and ref, so it must forward both to its DOM node (same requirement
   * as `<Tooltip>`'s own `children`). Usually a link.
   */
  children: ReactElement;
  /** Which side of the trigger the card appears on. @default 'bottom' */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Alignment along the card's side axis. @default 'center' */
  align?: 'start' | 'center' | 'end';
  /** Delay in milliseconds before the card opens on hover. @default 700 */
  openDelay?: number;
  /** Delay in milliseconds before the card closes after the pointer leaves. @default 300 */
  closeDelay?: number;
  /** Per-instance overrides for shadow depth and border. */
  overrides?: Partial<HoverCardSliceState>;
}

/**
 * @manifest Hover-triggered preview card for rich, interactive content
 * @manifestCategory Overlays
 */
export const HoverCard: React.FC<HoverCardProps> = ({
  id,
  content,
  children,
  side = 'bottom',
  align = 'center',
  openDelay = 700,
  closeDelay = 300,
  overrides,
}) => {
  const { vars } = useSliceOverrides(HoverCardThemeSlice, overrides);
  const { container, zIndex } = useOverlayLayer('TOOLTIP');
  useOverlayArrowStyles();
  useOverlayAnimations('toolcrib-hovercard-animations-baseui', [{ className: 'ai-hovercard-content', enter: 'ai-fade-in', exit: 'ai-fade-out' }]);

  return (
    <OverlayCSP>
      <PreviewCard.Root onOpenChange={open => aiBus.emit(open ? 'hovercard:shown' : 'hovercard:hidden', { id })}>
        <PreviewCard.Trigger render={children} delay={openDelay} closeDelay={closeDelay} />
        <PreviewCard.Portal container={container}>
          <PreviewCard.Positioner side={side} align={align} sideOffset={8} style={{ zIndex }}>
            <PreviewCard.Popup
              className="ai-focus-ring ai-hovercard-content"
              style={{
                background: 'var(--ai-bg-surface, #ffffff)',
                border: BORDER,
                boxShadow: 'var(--ai-hovercard-shadow, 0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15))',
                borderRadius: 'var(--ai-radius-md, 0.375rem)',
                padding: 'var(--ai-padding-lg, 0.75rem)',
                maxWidth: '20rem',
                outline: 'none',
                // Not paint containment: it would clip the arrow (see
                // useOverlayArrowStyles).
                contain: 'layout style',
                ...vars,
              }}
            >
              <AIErrorBoundary componentName="HoverCard">{content}</AIErrorBoundary>
              <PreviewCard.Arrow
                className={OVERLAY_ARROW_CLASS}
                style={{ ['--ai-arrow-bg' as string]: 'var(--ai-bg-surface, #ffffff)', ['--ai-arrow-border' as string]: BORDER }}
              />
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    </OverlayCSP>
  );
};
