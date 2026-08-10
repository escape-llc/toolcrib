import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { useAdaptiveSize } from '../../observer/useAdaptiveSize';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';

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
 * Use with `<TabStrip.Panel>` for content areas — the two coordinate purely
 * through the `tab:changed` event on `aiBus`, matched by `id`/`groupId`.
 * They are NOT required to share a DOM ancestor, or even exist in the same
 * part of the tree: render `<TabStrip>` in a header region and every
 * `<TabStrip.Panel groupId="...">` somewhere else in the layout entirely,
 * and they still stay in sync. `<TabStrip>` broadcasts on mount and on
 * every change; it never reads panels back, so there's no prop-drilling of
 * "which tab is active" through a shared parent in either direction.
 */
export interface TabStripProps {
  /**
   * Identifies this tab group for event bus coordination — every
   * `<TabStrip.Panel groupId={...}>` that should respond to this control
   * must use the exact same string. Required (not auto-generated) because,
   * unlike a Modal's `id`, it has to be a stable value the panels — wherever
   * they're rendered — can reference independently.
   */
  id: string;
  /** Array of tab definitions to render. */
  items: TabItem[];
  /**
   * Controlled active tab id. Omit to let `<TabStrip>` manage its own
   * state internally — the common case, since panels never need it passed
   * down (they get it from the bus).
   */
  activeId?: string;
  /** Initial active tab when uncontrolled. @default items[0]?.id */
  defaultActiveId?: string;
  /**
   * Change callback for controlled usage (e.g. syncing with a router).
   * Cross-tree panels should not rely on this — they subscribe to
   * `tab:changed` via `useAIEvent` instead, which fires regardless of
   * whether this component is controlled or self-managed.
   */
  onChange?: (id: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

/** @manifest Scrollable tab header with filmstrip overflow. Use TabStrip.Panel for content */
export const TabStrip: React.FC<TabStripProps> & {
  Tab: React.FC<{ id: string; active?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean }>;
  Panel: React.FC<TabPanelProps>;
} = ({ id: groupId, items, activeId: controlledActiveId, defaultActiveId, onChange, className, style }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const [internalActiveId, setInternalActiveId] = useState(defaultActiveId ?? items[0]?.id ?? '');
  const isControlled = controlledActiveId !== undefined;
  const activeId = isControlled ? controlledActiveId : internalActiveId;

  // Broadcasts on mount (previousId undefined the first time) and on every
  // subsequent change — this is the only thing that keeps a
  // <TabStrip.Panel> elsewhere in sync, so it has to fire for the initial
  // value too, not just changes. The change-broadcast lives directly in
  // handleChange rather than in an effect watching the resolved `activeId`:
  // in controlled mode, `activeId` is the parent's prop, which only
  // changes if the parent re-renders in response to `onChange` — a click
  // alone doesn't guarantee that (or even that the parent updates state
  // synchronously), so an effect keyed on `activeId` can silently miss the
  // click entirely. `tab:changed` is a sticky event (see eventBus.ts), so
  // a <TabStrip.Panel> that subscribes after this fires still gets the
  // current value replayed to it.
  const previousIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    aiBus.emit('tab:changed', { id: groupId, activeId, previousId: undefined });
    previousIdRef.current = activeId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (nextId: string) => {
    if (!isControlled) setInternalActiveId(nextId);
    onChange?.(nextId);
    if (nextId !== previousIdRef.current) {
      aiBus.emit('tab:changed', { id: groupId, activeId: nextId, previousId: previousIdRef.current });
      previousIdRef.current = nextId;
    }
  };

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
      onValueChange={handleChange}
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
                onClick={() => !item.disabled && handleChange(item.id)}
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
  /**
   * The `id` of the `<TabStrip>` group this panel belongs to — must match
   * that TabStrip's own `id` exactly. This is the *only* link between them;
   * they don't need to share a DOM ancestor. Rendering this panel without
   * its matching TabStrip mounted anywhere is valid — it just never
   * receives a `tab:changed` event, so it stays hidden.
   */
  groupId: string;
  /** The tab id (matching one of that TabStrip's `items`) this panel renders for. */
  value: string;
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Content for one tab of a `<TabStrip groupId>` — rendered independently,
 * anywhere in the tree. Visibility comes entirely from listening for
 * `tab:changed` on `aiBus`, filtered to this panel's `groupId`; nothing is
 * passed down through props or React context from a shared parent.
 *
 * `tab:changed` is a sticky event (see eventBus.ts's `STICKY_EVENTS`): the
 * bus remembers the last value broadcast for each `id`, and replays it to
 * a subscriber immediately when it calls `on()` — so it doesn't matter
 * whether the matching `<TabStrip>` happened to mount, and broadcast,
 * before or after this panel's own subscription effect ran. Without that,
 * two unrelated subtrees mounting in the same commit would have no
 * ordering guarantee, and a panel could permanently miss the initial
 * broadcast depending on commit order.
 */
export const TabPanel: React.FC<TabPanelProps> = ({ groupId, value, children, style, className, ...props }) => {
  const [isActive, setIsActive] = useState(false);

  useAIEvent('tab:changed', (event) => {
    if (event.id === groupId) setIsActive(event.activeId === value);
  });

  if (!isActive) return null;

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
