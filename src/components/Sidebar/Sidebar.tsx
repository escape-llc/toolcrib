import React, { type ReactNode, useState } from 'react';
import { NavigationMenu as NavigationMenuPrimitive } from 'radix-ui';
import { getSparseVariables } from '../../theme/slice';
import { SidebarThemeSlice, type SidebarSliceState } from './SidebarSlice';
import { useReportSidebarCollapsed } from '../AppShell/AppShell';

/** Data shape for each nav item in a `<Sidebar>`. */
export interface SidebarItemData {
  /** Unique key for this item, and the value reported via `activeId`/`onItemClick`. */
  id: string;
  /** Label text — hidden (not just visually truncated) while the sidebar is collapsed, so only `icon` remains. */
  label: ReactNode;
  /** Icon rendered before the label. Still shown, alone, in collapsed mode — the only thing collapsed mode has room for. */
  icon?: ReactNode;
  /** Href for this item's link. Omit for a JS-driven item (`onClick`/`onItemClick` only). */
  href?: string;
  /** If true, this item is not selectable. */
  disabled?: boolean;
}

/** Props for the `<Sidebar>` nav list, typically placed inside `<AppShell.Sidebar>`. */
export interface SidebarProps {
  /** Nav items to render. */
  items: SidebarItemData[];
  /** Currently active item id — renders with `aria-current="page"`. */
  activeId?: string;
  /** Called when an item is clicked, with that item's id. */
  onItemClick?: (id: string) => void;
  /** Controlled collapsed (icon-only) state. Omit to let `<Sidebar>` manage it internally via its own built-in toggle button. */
  collapsed?: boolean;
  /** Initial collapsed state when uncontrolled (`collapsed` omitted). @default false */
  defaultCollapsed?: boolean;
  /** Called whenever collapsed state changes, whether controlled or uncontrolled. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Per-instance override for nav item spacing. */
  overrides?: Partial<SidebarSliceState>;
  /** Accessible name for the nav landmark. Required for a meaningful accessible name unless `aria-labelledby` is given instead — without either, Radix's NavigationMenu warns and the landmark has none at all. */
  'aria-label'?: string;
  /** Same as `aria-label`, but referencing an existing visible label element's id instead of a literal string. */
  'aria-labelledby'?: string;
}

// Icon + its padding (0.5rem each side, per the collapsed <Link> style
// below) plus a little breathing room -- the width the rail actually
// collapses to. Without an explicit width here the root stayed at
// width: 100% even while collapsed, since only the items inside were
// re-centering; the rail itself never got physically narrower.
const COLLAPSED_WIDTH = '3.5rem';

/**
 * @manifest Vertical nav-item list built on Radix NavigationMenu, with a collapsed icon-only mode
 * @manifestCategory Containers
 */
export const Sidebar: React.FC<SidebarProps> = ({
  items,
  activeId,
  onItemClick,
  collapsed: externalCollapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  overrides,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}) => {
  // Same controlled/uncontrolled split as every other stateful component in
  // this toolkit -- but collapsed state is local UI state that manages
  // itself by default (mirroring <Collapsible>'s own open state), not
  // something a consumer is expected to lift into app state just to get a
  // working toggle button.
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const isCollapsedControlled = externalCollapsed !== undefined;
  const collapsed = isCollapsedControlled ? externalCollapsed : internalCollapsed;
  const sidebarVars = getSparseVariables(SidebarThemeSlice, overrides ?? {});
  // Resizes an ancestor <AppShell.Sidebar> alongside this rail, if one is
  // present -- see AppShell.tsx's own comment on why the aside doesn't
  // already know to do this on its own.
  useReportSidebarCollapsed(collapsed);

  const toggleCollapsed = () => {
    const next = !collapsed;
    if (!isCollapsedControlled) setInternalCollapsed(next);
    onCollapsedChange?.(next);
  };

  return (
    <NavigationMenuPrimitive.Root
      orientation="vertical"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: collapsed ? COLLAPSED_WIDTH : '100%',
        flexShrink: 0,
        // The var, not `width ${var}` -- --ai-transition-normal already
        // resolves to a complete `transition` shorthand value (e.g. `all
        // 220ms cubic-bezier(...)`, see animation.tsx's own
        // getAnimationVariables()), not just a duration+easing pair meant
        // to be prefixed with a property name. Prepending "width " in
        // front of that produced an invalid declaration ("width all
        // 220ms ...") that the browser silently drops -- the collapse
        // was snapping instantly with no ThemeProvider mounted, not
        // animating at all, until this was caught (reported directly).
        transition: 'var(--ai-transition-normal, all 0.2s cubic-bezier(0.4, 0, 0.2, 1))',
      }}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!collapsed}
        className="ai-btn"
        style={{
          all: 'unset',
          cursor: 'pointer',
          alignSelf: collapsed ? 'center' : 'flex-end',
          padding: '0.375rem',
          marginBottom: '0.5rem',
          color: 'var(--ai-text-secondary, #6b7280)',
          borderRadius: 'var(--ai-radius-sm, 0.25rem)',
        }}
      >
        {collapsed ? '»' : '«'}
      </button>

      <NavigationMenuPrimitive.List
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--ai-sidebar-item-gap, 0.125rem)',
          listStyle: 'none',
          margin: 0,
          padding: 0,
          ...sidebarVars,
        }}
      >
        {items.map(item => {
          const isActive = item.id === activeId;
          return (
            <NavigationMenuPrimitive.Item key={item.id}>
              <NavigationMenuPrimitive.Link
                href={item.href ?? '#'}
                active={isActive}
                aria-current={isActive ? 'page' : undefined}
                aria-disabled={item.disabled || undefined}
                title={collapsed && typeof item.label === 'string' ? item.label : undefined}
                onClick={e => {
                  if (item.disabled) {
                    e.preventDefault();
                    return;
                  }
                  if (!item.href) e.preventDefault();
                  onItemClick?.(item.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: collapsed ? '0.5rem' : '0.5rem 0.75rem',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 'var(--ai-radius-md, 0.375rem)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 'var(--ai-font-weight-semibold, 600)' : 'var(--ai-font-weight-normal, 400)',
                  color: isActive ? 'var(--ai-color-primary, #3b82f6)' : 'var(--ai-text-primary, #111827)',
                  background: isActive ? 'var(--ai-subtheme-info-bg, rgba(59, 130, 246, 0.1))' : 'transparent',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  opacity: item.disabled ? 0.5 : 1,
                }}
              >
                {item.icon && <span style={{ flexShrink: 0, display: 'inline-flex' }}>{item.icon}</span>}
                {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
              </NavigationMenuPrimitive.Link>
            </NavigationMenuPrimitive.Item>
          );
        })}
      </NavigationMenuPrimitive.List>
    </NavigationMenuPrimitive.Root>
  );
};
