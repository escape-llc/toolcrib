import React, { useState, ReactNode, ReactElement, cloneElement, isValidElement } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { Z_INDEX } from '../../theme/zIndex';

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
  style?: React.CSSProperties;
  /**
   * Z-index layer. Uses the toolkit's Z_INDEX.DROPDOWN tier by default.
   * @default Z_INDEX.DROPDOWN (300)
   */
  zIndex?: number;
}

export const Popup: React.FC<PopupProps> = ({
  id = `popup-${Math.random().toString(36).substring(2, 7)}`,
  trigger,
  children,
  placement = 'bottom-start',
  isOpen: externalIsOpen,
  onOpenChange,
  style,
  zIndex = Z_INDEX.DROPDOWN,
}) => {
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

  const getTriggerCornerStyle = (): React.CSSProperties => {
    switch (placement) {
      case 'bottom-start': return { borderBottomLeftRadius: isOpen ? 0 : 'inherit' };
      case 'bottom-end': return { borderBottomRightRadius: isOpen ? 0 : 'inherit' };
      case 'top-start': return { borderTopLeftRadius: isOpen ? 0 : 'inherit' };
      case 'top-end': return { borderTopRightRadius: isOpen ? 0 : 'inherit' };
    }
  };

  const getPopupCornerStyle = (): React.CSSProperties => {
    const r = 'var(--ai-radius-lg, 0.5rem)';
    switch (placement) {
      case 'bottom-start': return { borderRadius: `0 ${r} ${r} ${r}` };
      case 'bottom-end': return { borderRadius: `${r} 0 ${r} ${r}` };
      case 'top-start': return { borderRadius: `${r} ${r} ${r} 0` };
      case 'top-end': return { borderRadius: `${r} ${r} 0 ${r}` };
    }
  };

  const getRadixSideAndAlign = (): { side: 'top' | 'bottom'; align: 'start' | 'end' } => {
    switch (placement) {
      case 'bottom-start': return { side: 'bottom', align: 'start' };
      case 'bottom-end': return { side: 'bottom', align: 'end' };
      case 'top-start': return { side: 'top', align: 'start' };
      case 'top-end': return { side: 'top', align: 'end' };
    }
  };

  const { side, align } = getRadixSideAndAlign();
  const typedTrigger = trigger as ReactElement<{ style?: React.CSSProperties }>;
  const renderedTrigger = isValidElement(typedTrigger)
    ? cloneElement(typedTrigger, {
        style: {
          ...(typedTrigger.props.style || {}),
          ...getTriggerCornerStyle(),
          transition: 'border-radius 0.15s ease',
        },
      })
    : trigger;

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={open => handleOpenChange(open)}>
      <PopoverPrimitive.Trigger asChild>
        <div style={{ display: 'inline-block', cursor: 'pointer' }}>{renderedTrigger}</div>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          align={align}
          sideOffset={-1}
          style={{
            zIndex,
            background: 'var(--ai-bg-surface, #ffffff)',
            border: '0.0625rem solid var(--ai-border, #e5e7eb)',
            boxShadow: '0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15)',
            padding: '0.75rem',
            minWidth: '11.25rem',
            outline: 'none',
            ...getPopupCornerStyle(),
            ...style,
          }}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};
