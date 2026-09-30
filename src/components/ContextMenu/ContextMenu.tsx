'use client';

// ContextMenu on Base UI's ContextMenu (#670, #700), a drop-in for the earlier
// Radix version. Base UI positions the menu at the pointer and opens it on
// right-click or long press; its parts are Menu's own, so the popup and items
// are the ones DropdownMenu renders (../DropdownMenu/menuParts).
import React, { type ReactNode } from 'react';
import { ContextMenu as BaseContextMenu } from '@base-ui/react/context-menu';
import { aiBus } from '../../eventBus/eventBus';
import { useStableId } from '../shared/useStableId';
import { type MenuItemData } from '../DropdownMenu/DropdownMenu';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { type SubthemeName } from '../../theme/subtheme';
import { ContextMenuThemeSlice, type ContextMenuSliceState } from './ContextMenuSlice';
import { ANCHORED_POP, DROPDOWN_COLLISION, OverlayCSP, useOverlayAnimations, useOverlayLayer } from '../Overlay/baseui/overlayLayer';
import { MENU_POPUP_CLASS, MenuItemList, menuPopupStyle } from '../DropdownMenu/menuParts';

/**
 * Props for the `<ContextMenu>` right-click action menu.
 *
 * Data-driven, same `items` shape as `<DropdownMenu>` (reused directly —
 * both are "a menu", just opened by a different gesture) and emits the
 * same `menu:opened`/`menu:closed`/`menu:item_selected` events, filterable
 * by `id` the same way.
 */
export interface ContextMenuProps {
  /** Unique identifier for event bus targeting. Auto-generated if omitted. */
  id?: string;
  /** The area that opens the menu on right-click or long press. Rendered inline, wrapping `children`. */
  children: ReactNode;
  /** Array of menu items to render. */
  items: MenuItemData[];
  /** Per-instance overrides for shadow depth and item density. */
  overrides?: Partial<ContextMenuSliceState> & { subtheme?: SubthemeName };
}

/**
 * @manifest Right-click action menu, data-driven with separator support
 * @manifestCategory Overlays
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({
  id: propId,
  children,
  items,
  overrides,
}) => {
  const id = useStableId(propId, 'contextmenu');
  const { vars: menuVars } = useSliceOverrides(ContextMenuThemeSlice, overrides);
  const { container, zIndex } = useOverlayLayer('DROPDOWN');
  useOverlayAnimations('toolcrib-menu-animations-baseui', [{ className: MENU_POPUP_CLASS, ...ANCHORED_POP }]);

  return (
    <OverlayCSP>
      <BaseContextMenu.Root onOpenChange={open => aiBus.emit(open ? 'menu:opened' : 'menu:closed', { id })}>
        <BaseContextMenu.Trigger style={{ display: 'inline-block' }}>{children}</BaseContextMenu.Trigger>
        <BaseContextMenu.Portal container={container}>
          <BaseContextMenu.Positioner collisionAvoidance={DROPDOWN_COLLISION} style={{ zIndex }}>
            <BaseContextMenu.Popup
              className={`ai-focus-ring ${MENU_POPUP_CLASS}`}
              style={{
                ...menuPopupStyle('--ai-contextmenu-shadow'),
                borderRadius: 'var(--ai-radius-md, 0.375rem)',
                ...menuVars,
              }}
            >
              <MenuItemList id={id} items={items} paddingVar="--ai-contextmenu-item-padding" />
            </BaseContextMenu.Popup>
          </BaseContextMenu.Positioner>
        </BaseContextMenu.Portal>
      </BaseContextMenu.Root>
    </OverlayCSP>
  );
};
