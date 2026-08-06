import React, { useState, useRef, useEffect, ReactNode } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { useAdaptiveSize } from '../../observer/useAdaptiveSize';
import { aiBus } from '../../eventBus/eventBus';

/** Data shape for each tab in a `<TabStrip>`. */
export interface TabItem {
  /** Unique identifier for this tab — used in `activeId` and `onChange`. */
  id: string;
  /** Label content rendered in the tab header. */
  label: ReactNode;
  /** Optional icon rendered before the label. */
  icon?: ReactNode;
  /** If true, the tab cannot be selected. */
  disabled?: boolean;
}

/**
 * Props for the `<TabStrip>` scrollable tab header.
 *
 * Use with `<TabStrip.Panel>` or `<TabPanel>` for content areas.
 * Emits `tab:changed` events on the event bus.
 */
export interface TabStripProps {
  /** Array of tab definitions to render. */
  items: TabItem[];
  /** The `id` of the currently active tab (controlled). */
  activeId: string;
  /** Callback fired when the user selects a different tab. */
  onChange: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const TabStrip: React.FC<TabStripProps> & {
  Tab: React.FC<{ id: string; active?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean }>;
  Panel: React.FC<TabPanelProps>;
} = ({ items, activeId, onChange, className, style }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const { width } = useAdaptiveSize(scrollContainerRef);

  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleScroll = () => checkScroll();
    el.addEventListener('scroll', handleScroll);

    return () => {
      el.removeEventListener('scroll', handleScroll);
    };
  }, [items, width]);

  const scrollBy = (delta: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  return (
    <TabsPrimitive.Root
      value={activeId}
      onValueChange={(val) => {
        aiBus.emit('tab:changed', { activeId: val, previousId: activeId });
        onChange(val);
      }}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--ai-bg-container, #f9fafb)',
        borderRadius: 'var(--ai-radius-lg, 0.5rem)',
        border: '0.0625rem solid var(--ai-border, #e5e7eb)',
        padding: '0.25rem',
        position: 'relative',
        userSelect: 'none',
        maxWidth: '100%',
        ...style,
      }}
    >
      {/* Filmstrip Left Scroll Button */}
      {canScrollLeft && (
        <button
          onClick={() => scrollBy(-180)}
          aria-label="Scroll tabs left"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.75rem',
            height: '1.75rem',
            borderRadius: 'var(--ai-radius-md, 0.375rem)',
            background: 'var(--ai-bg-surface, #ffffff)',
            border: '0.0625rem solid var(--ai-border, #d1d5db)',
            color: 'var(--ai-text-primary, #111827)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            marginRight: '0.25rem',
            boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.05)',
            flexShrink: 0,
            zIndex: 2,
          }}
        >
          ◀
        </button>
      )}

      {/* Connected Tab List Scroll Container using Radix Tabs.List */}
      <TabsPrimitive.List
        ref={scrollContainerRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.125rem',
          overflowX: 'auto',
          scrollBehavior: 'smooth',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          flex: 1,
          outline: 'none',
        }}
      >
        {items.map((item, index) => {
          const isActive = item.id === activeId;
          const prevIsActive = index > 0 && items[index - 1].id === activeId;
          const showDivider = index > 0 && !isActive && !prevIsActive;

          return (
            <React.Fragment key={item.id}>
              {showDivider && (
                <div
                  style={{
                    width: '0.0625rem',
                    height: '1.125rem',
                    background: 'var(--ai-border, #d1d5db)',
                    opacity: 0.7,
                    flexShrink: 0,
                    margin: '0 0.125rem',
                  }}
                />
              )}
              <TabsPrimitive.Trigger
                value={item.id}
                disabled={item.disabled}
                onClick={() => !item.disabled && onChange(item.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: 'var(--ai-tab-padding, 0.4375rem 0.875rem)',
                  fontSize: 'var(--ai-tab-font-size, 0.875rem)',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--ai-tab-active-color, #ffffff)' : 'var(--ai-tab-inactive-color, var(--ai-text-primary, #111827))',
                  background: isActive ? 'var(--ai-tab-active-bg, var(--ai-color-primary, #3b82f6))' : 'transparent',
                  border: isActive ? 'var(--ai-tab-active-border, none)' : 'none',
                  borderRadius: 'var(--ai-tab-border-radius, var(--ai-radius-md, 0.375rem))',
                  cursor: item.disabled ? 'not-allowed' : 'pointer',
                  opacity: item.disabled ? 0.5 : 1,
                  whiteSpace: 'nowrap',
                  transition: 'var(--ai-transition-fast, all 0.15s ease)',
                  flexShrink: 0,
                  outline: 'none',
                }}
              >
                {item.icon && <span>{item.icon}</span>}
                <span>{item.label}</span>
              </TabsPrimitive.Trigger>
            </React.Fragment>
          );
        })}
      </TabsPrimitive.List>

      {/* Filmstrip Right Scroll Button */}
      {canScrollRight && (
        <button
          onClick={() => scrollBy(180)}
          aria-label="Scroll tabs right"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.75rem',
            height: '1.75rem',
            borderRadius: '0.375rem',
            background: 'var(--ai-bg-surface, #ffffff)',
            border: '0.0625rem solid var(--ai-border, #d1d5db)',
            color: 'var(--ai-text-primary, #111827)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            marginLeft: '0.25rem',
            boxShadow: '0 0.0625rem 0.125rem rgba(0,0,0,0.05)',
            flexShrink: 0,
            zIndex: 2,
          }}
        >
          ▶
        </button>
      )}
    </TabsPrimitive.Root>
  );
};

TabStrip.Tab = ({ active, onClick, children, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: '0.5rem 1rem',
      borderRadius: 'var(--ai-radius-md, 0.375rem)',
      border: 'none',
      background: active ? 'var(--ai-color-primary, #3b82f6)' : 'transparent',
      color: active ? '#ffffff' : 'var(--ai-text-primary, #111827)',
      fontWeight: active ? 700 : 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
    }}
  >
    {children}
  </button>
);

/**
 * Props for `<TabStrip.Panel>` / `<TabPanel>` content area.
 *
 * When `activeId` is provided, the panel auto-hides if `activeId !== value`.
 * Omit `activeId` to always render (useful for manual conditional rendering).
 */
export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The tab id this panel corresponds to. */
  value: string;
  /** The currently active tab id. Panel is hidden when `activeId !== value`. */
  activeId?: string;
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

export const TabPanel: React.FC<TabPanelProps> = ({ value, activeId, children, style, className, ...props }) => {
  if (activeId !== undefined && activeId !== value) return null;

  return (
    <div
      key={value}
      className={className}
      {...props}
      style={{
        width: '100%',
        animation: 'var(--ai-tab-panel-animation, ai-fade-in 0.22s ease)',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

TabStrip.Panel = TabPanel;

TabStrip.Tab.displayName = 'TabStrip.Tab';
TabStrip.Panel.displayName = 'TabStrip.Panel';
