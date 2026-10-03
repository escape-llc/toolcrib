'use client';

// DropdownMenu on Base UI's Menu (#670, #700), a drop-in for the earlier
// implementation (same export, props and events). Portal container, stacked z-index,
// CSP nonce and enter/exit keyframes come from the shared overlay layer; the
// popup and item looks are shared with ContextMenu (./menuParts).
//
// What Base UI gives us, as in Popup: its render prop puts the trigger
// semantics on the consumer's own element (no wrapper <div> to null the ARIA
// attributes of), and it doesn't aria-hide the rest of the page while open, so
// there is no aria-hidden-focus axe carve-out.
import React, { useRef, useState, type ReactNode, type ReactElement } from 'react';
import { Menu } from '@base-ui/react/menu';
import { aiBus } from '../../eventBus/eventBus';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { computeCornerSquaring, renderTriggerWithCornerSquaring, useActualPopoverSide } from '../../theme/connectedPopoverStyles';
import { useUIGroupSquareCorners } from '../UIGroup/UIGroupContext';
import { type SubthemeName } from '../../theme/subtheme';
import { DropdownMenuThemeSlice, type DropdownMenuSliceState } from './DropdownMenuSlice';
import { ANCHORED_POP, DROPDOWN_COLLISION, OverlayCSP, triggerRenderProps, useOverlayAnimations, useOverlayLayer } from '../Overlay/baseui/overlayLayer';
import { MENU_POPUP_CLASS, MenuItemList, menuPopupStyle } from './menuParts';

/** Data shape for each item in a `<DropdownMenu>`. */
export interface MenuItemData {
  /** Unique string value emitted in the `menu:item_selected` event. */
  value: string;
  /** Display label rendered in the menu item. */
  label: ReactNode;
  /** Optional icon rendered before the label. */
  icon?: ReactNode;
  /** If true, the item is visually dimmed and not clickable. */
  disabled?: boolean;
  /** If true, renders a horizontal separator line instead of a clickable item. */
  isSeparator?: boolean;
  /** Click handler for this individual item. */
  onClick?: () => void;
}

/**
 * Props for the `<DropdownMenu>` action menu.
 *
 * Data-driven: pass an `items` array and the menu renders all items.
 * Emits `menu:opened`, `menu:closed`, and `menu:item_selected` events.
 */
export interface DropdownMenuProps {
  /** Unique identifier for event bus targeting. Auto-generated if omitted. */
  id?: string;
  /**
   * Trigger element that opens the menu on click.
   * It becomes the trigger itself, not a child of a wrapper: it receives the trigger's props, ARIA and ref, so it must be a native element or a component that forwards props and a ref to its DOM node (toolcrib's `<Button>` and `<Tooltip>` both do). A non-`<button>` native element gets `role="button"` and keyboard activation automatically.
   */
  trigger: ReactElement;
  /** Array of menu items to render. */
  items: MenuItemData[];
  /**
   * Which side of the trigger the menu opens on.
   * @default 'bottom'
   */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * Alignment along the menu's side axis.
   * @default 'start'
   */
  align?: 'start' | 'center' | 'end';
  /** Per-instance overrides for shadow depth and item density. */
  overrides?: Partial<DropdownMenuSliceState> & { subtheme?: SubthemeName };
}

/**
 * @manifest Data-driven action menu with separator support
 * @manifestCategory Overlays
 */
export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  id: propId,
  trigger,
  items,
  side = 'bottom',
  align = 'start',
  overrides,
}) => {
  const id = useStableId(propId, 'menu');
  const { vars: menuVars } = useSliceOverrides(DropdownMenuThemeSlice, overrides);
  const { container, zIndex } = useOverlayLayer('DROPDOWN');
  useOverlayAnimations('toolcrib-menu-animations-baseui', [{ className: MENU_POPUP_CLASS, ...ANCHORED_POP }]);
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  // Base UI's popup carries data-side, so the collision-aware
  // corner squaring (see Popup.tsx) works unchanged.
  const actualSide = useActualPopoverSide(contentRef, side, isOpen);
  const squaring = computeCornerSquaring(actualSide, align, isOpen, 'var(--ai-radius-md, 0.375rem)');
  const uiGroupSquareCorners = useUIGroupSquareCorners();
  const renderedTrigger = renderTriggerWithCornerSquaring(trigger, squaring, uiGroupSquareCorners) as ReactElement;

  return (
    <OverlayCSP>
      <Menu.Root
        onOpenChange={open => {
          setIsOpen(open);
          aiBus.emit(open ? 'menu:opened' : 'menu:closed', { id });
        }}
      >
        <Menu.Trigger {...triggerRenderProps(renderedTrigger)} />
        <Menu.Portal container={container}>
          <Menu.Positioner side={side} align={align} sideOffset={squaring.sideOffset} collisionAvoidance={DROPDOWN_COLLISION} style={{ zIndex }}>
            <Menu.Popup
              ref={contentRef}
              className={`ai-focus-ring ${MENU_POPUP_CLASS}`}
              style={{
                ...menuPopupStyle('--ai-dropdownmenu-shadow'),
                ...squaring.popupCornerStyle,
                ...menuVars,
              }}
            >
              <MenuItemList id={id} items={items} paddingVar="--ai-dropdownmenu-item-padding" />
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </OverlayCSP>
  );
};
