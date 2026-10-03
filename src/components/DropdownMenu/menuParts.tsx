'use client';

// What DropdownMenu, ContextMenu and DataTable's column menu share on Base UI
// (#670, #700): the popup's look and the item's look. Base UI's ContextMenu
// re-exports Menu's own Popup/Item/Separator, so one item renderer serves both
// menus. Items carry data-highlighted, so the shared
// `.ai-menu-item[data-highlighted]` rule (interactionStyles.ts) still applies.
import React, { type CSSProperties } from 'react';
import { Menu } from '@base-ui/react/menu';
import { aiBus } from '../../eventBus/eventBus';
import { type MenuItemData } from './DropdownMenu';

/** Enter/exit keyframes for every menu popup, keyed on this class. */
export const MENU_POPUP_CLASS = 'ai-menu-popup';

/** The menu panel: surface, border, shadow and column layout. `shadowVar` is the owning slice's shadow variable. */
export function menuPopupStyle(shadowVar: string): CSSProperties {
  return {
    minWidth: '11.25rem',
    padding: 'var(--ai-padding-sm, 0.375rem)',
    background: 'var(--ai-bg-surface, #ffffff)',
    border: '0.0625rem solid var(--ai-border, #e5e7eb)',
    boxShadow: `var(${shadowVar}, 0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15))`,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.125rem',
    outline: 'none',
    // Fits the viewport (#736): Base UI's Positioner sets --available-height
    // (space from the trigger, or the pointer, to the viewport edge on this
    // side); a longer menu scrolls instead of running off-screen.
    maxHeight: 'var(--available-height)',
    overflowY: 'auto',
    // Self-contained floating menu — see Modal.tsx's identical reasoning.
    contain: 'content',
  };
}

/** One menu row. `paddingVar` is the owning slice's item-padding variable. */
export function menuItemStyle(disabled: boolean | undefined, paddingVar: string): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: `var(${paddingVar}, 0.4375rem 0.75rem)`,
    fontSize: '0.875rem',
    fontWeight: 'var(--ai-font-weight-medium, 500)',
    borderRadius: 'var(--ai-radius-sm, 0.25rem)',
    color: 'var(--ai-text-primary, #111827)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    outline: 'none',
    transition: 'background var(--ai-transition-duration-fast, 0.15s) var(--ai-transition-easing, ease)',
  };
}

const SEPARATOR_STYLE: CSSProperties = {
  height: '0.0625rem',
  background: 'var(--ai-border, #e5e7eb)',
  margin: '0.25rem 0',
};

/**
 * Renders a data-driven `items` list as Base UI menu items and separators.
 * Selecting an item emits `menu:item_selected` for the menu `id`, then runs
 * the item's own `onClick`. Base UI closes the menu after the click.
 */
export const MenuItemList: React.FC<{ id: string; items: MenuItemData[]; paddingVar: string }> = ({ id, items, paddingVar }) => (
  <>
    {items.map((item, idx) =>
      item.isSeparator ? (
        <Menu.Separator key={idx} style={SEPARATOR_STYLE} />
      ) : (
        <Menu.Item
          key={item.value || idx}
          disabled={item.disabled}
          onClick={() => {
            aiBus.emit('menu:item_selected', { id, itemValue: item.value });
            item.onClick?.();
          }}
          className="ai-menu-item"
          style={menuItemStyle(item.disabled, paddingVar)}
        >
          {item.icon && <span>{item.icon}</span>}
          <span>{item.label}</span>
        </Menu.Item>
      )
    )}
  </>
);
