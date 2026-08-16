import React, { useState, ReactNode, ReactElement, cloneElement, isValidElement } from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { Z_INDEX } from '../../theme/zIndex';
import { SquareCornerOption } from '../Card/Card';
import { AIErrorBoundary } from '../ErrorBoundary/AIErrorBoundary';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { SubthemeName } from '../../theme/subtheme';
import { TRIGGER_WRAPPER_STYLE } from '../../theme/triggerWrapperStyle';
import { PopupThemeSlice, PopupSliceState } from './PopupSlice';

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
  useInjectInteractionStyles();
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

  // Which corner of the trigger should flatten against the popup while
  // open, expressed as the shared SquareCornerOption vocabulary
  // (Card/Content/Button all understand it) rather than a raw style
  // object — used for a trigger that's a toolcrib component (the common
  // case, e.g. <Button>) and can consult this prop itself. A plain DOM
  // element trigger can't consult a typed prop, so it still gets a
  // directly-injected style patch — see renderedTrigger below.
  const getTriggerSquareCorners = (): SquareCornerOption => {
    if (!isOpen) return 'none';
    switch (placement) {
      case 'bottom-start': return ['bottom-left'];
      case 'bottom-end': return ['bottom-right'];
      case 'top-start': return ['top-left'];
      case 'top-end': return ['top-right'];
    }
  };

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
  const typedTrigger = trigger as ReactElement<any>;
  const isTriggerComponent = isValidElement(typedTrigger) && typeof typedTrigger.type !== 'string';
  const renderedTrigger = !isValidElement(typedTrigger)
    ? trigger
    : isTriggerComponent
    ? cloneElement(typedTrigger as ReactElement<any>, { squareCorners: getTriggerSquareCorners() })
    : cloneElement(typedTrigger as ReactElement<any>, {
        style: {
          ...((typedTrigger.props as any).style || {}),
          ...getTriggerCornerStyle(),
          transition: 'border-radius 0.15s ease',
        },
      });

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
        <div style={TRIGGER_WRAPPER_STYLE}>{renderedTrigger}</div>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal container={targetDocument?.body}>
        <PopoverPrimitive.Content
          side={side}
          align={align}
          sideOffset={-1}
          className="ai-focus-ring"
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
            ...getPopupCornerStyle(),
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
