import React, { ReactNode, useEffect } from 'react';
import { ContextMenu as ContextMenuPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { Z_INDEX } from '../../theme/zIndex';
import { useStableId } from '../shared/useStableId';
import { MenuItemData } from '../DropdownMenu/DropdownMenu';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { injectInteractionStyles } from '../../theme/interactionStyles';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { SubthemeName } from '../../theme/subtheme';
import { ContextMenuThemeSlice, ContextMenuSliceState } from './ContextMenuSlice';

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
  /** The area that opens the menu on right-click. Rendered inline, wrapping `children`. */
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
  const targetDocument = useTargetDocument();
  useEffect(() => {
    injectInteractionStyles(targetDocument);
  }, [targetDocument]);

  return (
    <ContextMenuPrimitive.Root
      onOpenChange={(open) => {
        if (open) {
          aiBus.emit('menu:opened', { id });
        } else {
          aiBus.emit('menu:closed', { id });
        }
      }}
    >
      <ContextMenuPrimitive.Trigger asChild>
        <div style={{ display: 'inline-block' }}>{children}</div>
      </ContextMenuPrimitive.Trigger>

      <ContextMenuPrimitive.Portal container={targetDocument?.body}>
        <ContextMenuPrimitive.Content
          className="ai-focus-ring"
          style={{
            zIndex: Z_INDEX.DROPDOWN,
            minWidth: '11.25rem',
            padding: 'var(--ai-padding-sm, 0.375rem)',
            borderRadius: 'var(--ai-radius-md, 0.375rem)',
            background: 'var(--ai-bg-surface, #ffffff)',
            border: '0.0625rem solid var(--ai-border, #e5e7eb)',
            boxShadow: 'var(--ai-contextmenu-shadow, 0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15))',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.125rem',
            outline: 'none',
            // Self-contained floating menu — see Modal.tsx's identical
            // reasoning.
            contain: 'content',
            ...menuVars,
          }}
        >
          {items.map((item, idx) => {
            if (item.isSeparator) {
              return (
                <ContextMenuPrimitive.Separator
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
              <ContextMenuPrimitive.Item
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
                  padding: 'var(--ai-contextmenu-item-padding, 0.4375rem 0.75rem)',
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
              </ContextMenuPrimitive.Item>
            );
          })}
        </ContextMenuPrimitive.Content>
      </ContextMenuPrimitive.Portal>
    </ContextMenuPrimitive.Root>
  );
};
