'use client';

// SPIKE (#670): trigger-mode Popup on Base UI's Popover, to measure (1) enter/
// exit animation handling against e2e/overlay-animations.spec.ts and (2)
// whether Base UI's `render` prop removes Popup.tsx's wrapper-div + focus-
// return workaround (#421). No anchor mode, corner squaring or slice
// overrides. Not for merge.
import React, { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { Popover as BasePopover } from '@base-ui/react/popover';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { Z_INDEX } from '../../theme/zIndex';
import { useStableId } from '../shared/useStableId';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { useNonce } from '../../theme/nonceContext';
import { type PopupPlacement } from './Popup';

// Same keyframes and timing as Popup.tsx; Base UI marks state with
// data-open / data-closed instead of Radix's data-state, and holds the node
// mounted until the element's running animations finish.
function injectAnimations(targetDocument?: Document, nonce?: string): void {
  injectGlobalStyle(
    'toolcrib-popup-baseui-animations',
    `
    .ai-popup-content[data-open] {
      animation: ai-fade-in var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease);
    }
    .ai-popup-content[data-closed] {
      animation: ai-fade-out var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease) forwards;
    }
    `,
    targetDocument,
    nonce
  );
}

/** @barrelExport */
export interface PopupBaseUIProps {
  id?: string;
  trigger: ReactElement;
  children: ReactNode;
  placement?: PopupPlacement;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  zIndex?: number;
}

export const PopupBaseUI: React.FC<PopupBaseUIProps> = ({
  id: propId,
  trigger,
  children,
  placement = 'bottom-start',
  isOpen: externalIsOpen,
  onOpenChange,
  zIndex = Z_INDEX.DROPDOWN,
}) => {
  const id = useStableId(propId, 'popup');
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  useInjectInteractionStyles();
  useEffect(() => {
    injectAnimations(targetDocument, nonce);
  }, [targetDocument, nonce]);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const handleOpenChange = (open: boolean, fromBus = false) => {
    if (externalIsOpen === undefined) setInternalIsOpen(open);
    onOpenChange?.(open);
    if (!fromBus) aiBus.emit(open ? 'popup:shown' : 'popup:hidden', { id });
  };
  useAIEvent('popup:shown', e => {
    if (e.id === id && !isOpen) handleOpenChange(true, true);
  });
  useAIEvent('popup:hidden', e => {
    if (e.id === id && isOpen) handleOpenChange(false, true);
  });

  const [side, align] = placement.split('-') as ['top' | 'bottom', 'start' | 'end'];

  return (
    <BasePopover.Root open={isOpen} onOpenChange={open => handleOpenChange(open)}>
      {/* `render` puts the trigger props (aria-expanded, aria-haspopup,
          handlers, ref) straight onto the consumer's element: no wrapper div,
          so no nulled ARIA and no hand-rolled focus return. */}
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal container={targetDocument?.body}>
        <BasePopover.Positioner side={side} align={align} sideOffset={4} style={{ zIndex }}>
          <BasePopover.Popup
            className="ai-focus-ring ai-popup-content"
            style={{
              background: 'var(--ai-bg-surface, #ffffff)',
              border: 'var(--ai-popup-border, 0.0625rem solid var(--ai-border, #e5e7eb))',
              boxShadow: 'var(--ai-popup-shadow, 0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15))',
              padding: 'var(--ai-padding-lg, 0.75rem)',
              borderRadius: 'var(--ai-radius-md, 0.375rem)',
              minWidth: '11.25rem',
              outline: 'none',
            }}
          >
            {children}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
};
