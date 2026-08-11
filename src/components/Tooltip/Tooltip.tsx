import React, { ReactNode, useState } from 'react';
import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { TooltipThemeSlice, TooltipSliceState } from './TooltipSlice';

/**
 * Props for the `<Tooltip>` hover/focus information overlay.
 *
 * Wraps the `children` element and shows a tooltip on hover/focus.
 * Emits `tooltip:shown` / `tooltip:hidden` events on the event bus.
 */
export interface TooltipProps {
  /** Unique identifier for event bus targeting. */
  id?: string;
  /** Text or ReactNode rendered inside the tooltip bubble. */
  content: ReactNode;
  /** The element that triggers the tooltip on hover/focus. */
  children: ReactNode;
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
export const Tooltip: React.FC<TooltipProps> = ({
  id,
  content,
  children,
  side = 'top',
  align = 'center',
  delayDuration = 200,
  overrides,
}) => {
  const { vars } = useSliceOverrides(TooltipThemeSlice, overrides);
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      aiBus.emit('tooltip:shown', { id, content: String(content) });
    } else {
      aiBus.emit('tooltip:hidden', { id });
    }
  };

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={0}>
      <TooltipPrimitive.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        disableHoverableContent={true}
      >
        <TooltipPrimitive.Trigger
          asChild
          onClick={() => setIsOpen(false)}
          onPointerDown={() => setIsOpen(false)}
        >
          <span style={{ display: 'inline-block', cursor: 'pointer' }}>{children}</span>
        </TooltipPrimitive.Trigger>

        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            align={align}
            sideOffset={5}
            style={{
              zIndex: Z_INDEX.TOOLTIP,
              padding: 'var(--ai-tooltip-padding, 0.375rem 0.75rem)',
              fontSize: 'var(--ai-tooltip-font-size, 0.75rem)',
              fontWeight: 600,
              borderRadius: 'var(--ai-tooltip-border-radius, var(--ai-radius-md, 0.375rem))',
              background: 'var(--ai-tooltip-bg, var(--ai-text-primary, #111827))',
              color: 'var(--ai-tooltip-color, var(--ai-bg-surface, #ffffff))',
              boxShadow: '0 0.25rem 0.75rem rgba(0,0,0,0.15)',
              userSelect: 'none',
              pointerEvents: 'none',
              animation: 'ai-popup-fade 0.12s ease-out',
              ...vars,
            }}
          >
            {content}
            <TooltipPrimitive.Arrow style={{ fill: 'var(--ai-text-primary, #111827)' }} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
};
