import React, { ReactNode, ReactElement } from 'react';
import { HoverCard as HoverCardPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { AIErrorBoundary } from '../ErrorBoundary/AIErrorBoundary';
import { HoverCardThemeSlice, HoverCardSliceState } from './HoverCardSlice';

/**
 * Props for the `<HoverCard>` hover-triggered preview card.
 *
 * Unlike `<Tooltip>`, `content` may hold rich, interactive markup (a link,
 * an avatar + bio, a button) — the card doesn't disappear on pointer-down
 * the way Tooltip deliberately does, so a click inside it reaches its
 * target normally.
 */
export interface HoverCardProps {
  /** Unique identifier for event bus targeting. */
  id?: string;
  /** Rich content shown inside the card. */
  content: ReactNode;
  /**
   * The element that triggers the card on hover/focus. A single element —
   * passed straight through to Radix's own `asChild`, which requires one
   * ref-forwarding element to clone (same requirement as `<Tooltip>`'s own
   * `children`).
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
  const targetDocument = useTargetDocument();

  const handleOpenChange = (open: boolean) => {
    aiBus.emit(open ? 'hovercard:shown' : 'hovercard:hidden', { id });
  };

  return (
    <HoverCardPrimitive.Root openDelay={openDelay} closeDelay={closeDelay} onOpenChange={handleOpenChange}>
      <HoverCardPrimitive.Trigger asChild>{children}</HoverCardPrimitive.Trigger>

      <HoverCardPrimitive.Portal container={targetDocument?.body}>
        <HoverCardPrimitive.Content
          side={side}
          align={align}
          sideOffset={8}
          className="ai-focus-ring"
          style={{
            zIndex: Z_INDEX.TOOLTIP,
            background: 'var(--ai-bg-surface, #ffffff)',
            border: 'var(--ai-hovercard-border, 0.0625rem solid var(--ai-border, #e5e7eb))',
            boxShadow: 'var(--ai-hovercard-shadow, 0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15))',
            borderRadius: 'var(--ai-radius-md, 0.375rem)',
            padding: 'var(--ai-padding-lg, 0.75rem)',
            maxWidth: '20rem',
            outline: 'none',
            // Self-contained floating panel — already Radix-portaled to
            // document.body, so nothing inside needs to escape this box
            // (same reasoning as Popup/Modal's identical `contain: content`).
            contain: 'content',
            ...vars,
          }}
        >
          <AIErrorBoundary componentName="HoverCard">{content}</AIErrorBoundary>
          <HoverCardPrimitive.Arrow style={{ fill: 'var(--ai-bg-surface, #ffffff)' }} />
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
};
