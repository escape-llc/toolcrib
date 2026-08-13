import React, { ReactNode, ReactElement, useEffect } from 'react';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';
import { useStableId } from '../shared/useStableId';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { injectInteractionStyles } from '../../theme/interactionStyles';
import { SubthemeName } from '../../theme/subtheme';
import { DropdownMenuThemeSlice, DropdownMenuSliceState } from './DropdownMenuSlice';

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
  /** Trigger element that opens the menu on click. */
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
  useEffect(() => {
    injectInteractionStyles();
  }, []);

  return (
    <DropdownMenuPrimitive.Root
      onOpenChange={(open) => {
        if (open) {
          aiBus.emit('menu:opened', { id });
        } else {
          aiBus.emit('menu:closed', { id });
        }
      }}
    >
      <DropdownMenuPrimitive.Trigger asChild>
        <div style={{ display: 'inline-block', cursor: 'pointer' }}>{trigger}</div>
      </DropdownMenuPrimitive.Trigger>

      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          side={side}
          align={align}
          sideOffset={5}
          style={{
            zIndex: Z_INDEX.DROPDOWN,
            minWidth: '11.25rem',
            padding: 'var(--ai-padding-sm, 0.375rem)',
            borderRadius: 'var(--ai-radius-md, 0.375rem)',
            background: 'var(--ai-bg-surface, #ffffff)',
            border: '0.0625rem solid var(--ai-border, #e5e7eb)',
            boxShadow: 'var(--ai-dropdownmenu-shadow, 0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.125rem',
            outline: 'none',
            ...menuVars,
          }}
        >
          {items.map((item, idx) => {
            if (item.isSeparator) {
              return (
                <DropdownMenuPrimitive.Separator
                  key={idx}
                  style={{
                    height: '0.0625rem',
                    background: 'var(--ai-border, #e5e7eb)',
                    margin: '0.25rem 0',
                  }}
                />
              );
            }

            return (
              <DropdownMenuPrimitive.Item
                key={item.value || idx}
                disabled={item.disabled}
                onSelect={() => {
                  aiBus.emit('menu:item_selected', { id, itemValue: item.value });
                  if (item.onClick) item.onClick();
                }}
                className="ai-menu-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: 'var(--ai-dropdownmenu-item-padding, 0.4375rem 0.75rem)',
                  fontSize: '0.875rem',
                  fontWeight: 'var(--ai-font-weight-medium, 500)',
                  borderRadius: 'var(--ai-radius-sm, 0.25rem)',
                  color: 'var(--ai-text-primary, #111827)',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  opacity: item.disabled ? 0.5 : 1,
                  outline: 'none',
                  transition: 'background 0.12s ease',
                }}
              >
                {item.icon && <span>{item.icon}</span>}
                <span>{item.label}</span>
              </DropdownMenuPrimitive.Item>
            );
          })}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
};
