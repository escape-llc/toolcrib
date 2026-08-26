import React, { useState, useRef, useEffect, type ReactNode } from 'react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { aiBus } from '../../eventBus/eventBus';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { type StyleFreeAttributes, warnIfLegacyStyleProps } from '../../theme/safeProps';
import { useSliceOverrides } from '../../theme/useSliceOverrides';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { useScrollOverflow } from '../shared/useScrollOverflow';
import { TabThemeSlice, type TabSliceState } from './TabSlice';
import { injectGlobalStyle } from '../../theme/injectGlobalStyle';
import { useTargetDocument } from '../../theme/targetDocumentContext';
import { useNonce } from '../../theme/nonceContext';

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
  /** Per-instance overrides for variant, size, active-tab colour, and panel transition. */
  overrides?: Partial<TabSliceState>;
}

/**
 * @manifest Scrollable tab header with filmstrip overflow. Use TabStrip.Panel for content
 * @manifestCategory Data Display
 */
export const TabStrip: React.FC<TabStripProps> & {
  Tab: React.FC<{ id: string; active?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean }>;
  Panel: React.FC<TabPanelProps>;
} = ({ id: groupId, items, activeId: controlledActiveId, defaultActiveId, onChange, overrides }) => {
  const { vars } = useSliceOverrides(TabThemeSlice, overrides);
  useInjectInteractionStyles();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { canScrollLeft, canScrollRight, scrollBy } = useScrollOverflow(scrollContainerRef, [items]);

  const [internalActiveId, setInternalActiveId] = useState(defaultActiveId ?? items[0]?.id ?? '');
  const isControlled = controlledActiveId !== undefined;
  const activeId = isControlled ? controlledActiveId : internalActiveId;

  // Broadcasts on mount (previousId undefined the first time) and on every
  // subsequent change to the *resolved* activeId — this is the only thing
  // that keeps a <TabStrip.Panel> elsewhere in sync, so it has to fire for
  // the initial value too, not just changes. Keyed on activeId itself
  // (not fired manually from handleChange) specifically so a *controlled*
  // instance's activeId changing for any reason — a real click routed
  // through onChange, or a parent updating its own state programmatically
  // from somewhere else entirely (a <CommandPalette> "go to tab" command,
  // a router) — still broadcasts. A version of this that only emitted from
  // inside handleChange was reported directly: choosing a "go to tab"
  // command re-highlighted the clicked tab (the prop change alone re-renders
  // TabsPrimitive.Root correctly) but never switched the panel, since
  // nothing had called handleChange to fire the broadcast. `tab:changed` is
  // a sticky event (see eventBus.ts), so a <TabStrip.Panel> that subscribes
  // after this fires still gets the current value replayed to it.
  const previousIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    aiBus.emit('tab:changed', { id: groupId, activeId, previousId: previousIdRef.current });
    previousIdRef.current = activeId;
  }, [groupId, activeId]);

  // Evict this group's sticky entry on unmount, separately from the effect
  // above — this one deliberately stays mount/unmount-only (empty deps), so
  // it doesn't fire on every activeId change too. A statically-known,
  // hand-chosen `id` (the common case) never needs this — the sticky map
  // stays bounded by the small, fixed set of group ids the app defines. It
  // matters when `id` is generated per dynamic instance (e.g. one
  // <TabStrip> per row in a list), where every mount/unmount cycle would
  // otherwise leave its id's entry behind forever. See eventBus.ts's
  // clearSticky for why this is the owning component's call to make, not
  // the bus's.
  useEffect(() => {
    return () => {
      aiBus.clearSticky('tab:changed', groupId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (nextId: string) => {
    if (!isControlled) setInternalActiveId(nextId);
    onChange?.(nextId);
  };

  return (
    <TabsPrimitive.Root
      value={activeId}
      onValueChange={handleChange}
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--ai-bg-container, #f9fafb)',
        borderRadius: 'var(--ai-radius-lg, 0.5rem)',
        border: '0.0625rem solid var(--ai-border, #e5e7eb)',
        // Vertical padding only -- horizontal breathing room now lives on
        // the scrollable <TabsPrimitive.List> below instead, so the scroll
        // buttons can sit flush against the frame's own left/right edges
        // (full height, matching the frame's own corner radius) rather
        // than floating as an inset chip inside a uniform padding box.
        padding: 'var(--ai-padding-xs, 0.25rem) 0',
        position: 'relative',
        userSelect: 'none',
        maxWidth: '100%',
        ...vars,
      }}
    >
      {/* Filmstrip Left Scroll Button -- flush against the frame's left
          edge and full height, rounded only on the outer (left) corners
          so it reads as attached to the frame, not a floating pill. */}
      {canScrollLeft && (
        <button
          onClick={() => scrollBy(-180)}
          aria-label="Scroll tabs left"
          className="ai-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'stretch',
            width: '1.75rem',
            borderRadius: 'var(--ai-radius-lg, 0.5rem) 0 0 var(--ai-radius-lg, 0.5rem)',
            background: 'transparent',
            borderWidth: 0,
            borderRight: '0.0625rem solid var(--ai-border, #d1d5db)',
            color: 'var(--ai-text-primary, #111827)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            flexShrink: 0,
            zIndex: 2,
            ['--ai-btn-bg' as string]: 'var(--ai-bg-container, #f9fafb)',
          }}
        >
          ◀
        </button>
      )}

      {/* Connected Tab List Scroll Container using Radix Tabs.List */}
      <TabsPrimitive.List
        ref={scrollContainerRef}
        className="ai-focus-ring"
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
          padding: '0 var(--ai-padding-xs, 0.25rem)',
        }}
      >
        {items.map((item, index) => {
          const isActive = item.id === activeId;
          const prevIsActive = index > 0 && items[index - 1].id === activeId;
          // Hidden (not omitted) next to an active tab's colored background,
          // where a divider line would look redundant — via opacity, not
          // conditional rendering, so it still occupies its layout space
          // either way. Conditionally mounting/unmounting it here used to
          // change the filmstrip's total content width on every click
          // (whichever divider sat next to the newly/previously active tab
          // popped in or out), shifting every tab after it left or right —
          // the same class of activeId-driven width change as the
          // fontWeight fix above, just smaller in magnitude.
          const hideDivider = index === 0 || isActive || prevIsActive;

          return (
            <React.Fragment key={item.id}>
              {index > 0 && (
                <div
                  style={{
                    width: '0.0625rem',
                    height: '1.125rem',
                    background: 'var(--ai-border, #d1d5db)',
                    opacity: hideDivider ? 0 : 0.7,
                    flexShrink: 0,
                    margin: '0 0.125rem',
                  }}
                />
              )}
              <TabsPrimitive.Trigger
                value={item.id}
                disabled={item.disabled}
                onClick={() => !item.disabled && handleChange(item.id)}
                className="ai-tab-trigger"
                // Overrides Radix's own auto-generated aria-controls, which
                // points at the id of a same-value `Tabs.Content` this
                // component deliberately never renders -- `<TabStrip>` and
                // `<TabStrip.Panel>` coordinate purely over the `tab:changed`
                // event (see this file's own doc comment on `id`/`groupId`),
                // not a shared Radix Root/Content tree, so that id never
                // resolves to a real element (axe: aria-valid-attr-value).
                aria-controls={undefined}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: 'var(--ai-tab-padding, 0.4375rem 0.875rem)',
                  fontSize: 'var(--ai-tab-font-size, 0.875rem)',
                  // Deliberately the SAME weight regardless of active state
                  // — background fill + color already signal which tab is
                  // active. A per-state weight (bold active / medium
                  // inactive, the previous behavior) changes each label's
                  // rendered width, so every click shifted every tab left
                  // or right by several pixels — reported directly as
                  // "jarring" and, since this filmstrip can also toggle its
                  // own scroll-arrow buttons in response to the resulting
                  // width change (see checkScroll/useAdaptiveSize above), a
                  // real overflow trigger too, not just a cosmetic wobble.
                  fontWeight: 'var(--ai-font-weight-semibold, 600)',
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
                  // Same live color-mix hover as `.ai-btn` (see interactionStyles.ts)
                  // — this just publishes the active/inactive background this
                  // trigger already resolved to as the mix base.
                  ['--ai-tab-bg' as string]: isActive ? 'var(--ai-tab-active-bg, var(--ai-color-primary, #3b82f6))' : 'transparent',
                }}
              >
                {item.icon && <span>{item.icon}</span>}
                <span>{item.label}</span>
              </TabsPrimitive.Trigger>
            </React.Fragment>
          );
        })}
      </TabsPrimitive.List>

      {/* Filmstrip Right Scroll Button -- mirrors the left one: flush
          against the frame's right edge, full height, rounded only on
          the outer (right) corners. */}
      {canScrollRight && (
        <button
          onClick={() => scrollBy(180)}
          aria-label="Scroll tabs right"
          className="ai-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'stretch',
            width: '1.75rem',
            borderRadius: '0 var(--ai-radius-lg, 0.5rem) var(--ai-radius-lg, 0.5rem) 0',
            background: 'transparent',
            borderWidth: 0,
            borderLeft: '0.0625rem solid var(--ai-border, #d1d5db)',
            color: 'var(--ai-text-primary, #111827)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            flexShrink: 0,
            zIndex: 2,
            ['--ai-btn-bg' as string]: 'var(--ai-bg-container, #f9fafb)',
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
    className="ai-btn"
    style={{
      padding: 'var(--ai-padding-md, 0.5rem 1rem)',
      borderRadius: 'var(--ai-radius-md, 0.375rem)',
      border: 'none',
      background: active ? 'var(--ai-color-primary, #3b82f6)' : 'transparent',
      color: active ? 'var(--ai-color-primary-text, #ffffff)' : 'var(--ai-text-primary, #111827)',
      fontWeight: active ? 'var(--ai-font-weight-bold, 700)' : 'var(--ai-font-weight-medium, 500)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      ['--ai-btn-bg' as string]: active ? 'var(--ai-color-primary, #3b82f6)' : 'transparent',
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
export interface TabPanelProps extends StyleFreeAttributes<HTMLDivElement> {
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
const TAB_PANEL_STYLE_ID = 'toolcrib-tabstrip-panel-styles';

// Panel's own direct children default to flex-shrink:1 (the CSS initial
// value) like any flex item, which is wrong here specifically: when a
// panel's combined content is taller than whatever space its own ancestor
// gives it, the browser doesn't let that content overflow (and scroll,
// via the scroll region further up the tree that already exists for
// exactly this) -- it *shrinks* the children to fit instead, silently
// crushing whichever one has the least intrinsic size resistance down to
// a couple of pixels (found for real: a <Card> sitting after a much
// taller sibling <Grid> rendered at 2px tall, its own content still
// there in the DOM, just squeezed out of visibility). A scoped stylesheet
// rule (this component's own children only, not a global reset) is the
// fix, not an inline style -- Panel can't set `style` on arbitrary
// `children`, only a CSS selector reaches them generically regardless of
// what a consumer puts inside.
function injectTabPanelStyles(targetDocument?: Document, nonce?: string): void {
  injectGlobalStyle(
    TAB_PANEL_STYLE_ID,
    `.ai-tabstrip-panel > * { flex-shrink: 0; }`,
    targetDocument,
    nonce
  );
}

export const TabPanel: React.FC<TabPanelProps> = ({ groupId, value, children, ...props }) => {
  warnIfLegacyStyleProps(props, 'TabStrip.Panel');
  const [isActive, setIsActive] = useState(false);
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  useEffect(() => {
    injectTabPanelStyles(targetDocument, nonce);
  }, [targetDocument, nonce]);

  useAIEvent('tab:changed', (event) => {
    if (event.id === groupId) setIsActive(event.activeId === value);
  });

  if (!isActive) return null;

  return (
    <div
      key={value}
      {...props}
      className="ai-tabstrip-panel"
      style={{
        width: '100%',
        // Participates in a surrounding flex domain (e.g. <Content.Grow>)
        // and establishes its own for its children — without this, a
        // height:'100%' descendant (e.g. <Card layout="auto">) resolves
        // against a parent whose own height is content-based ('auto'),
        // which CSS treats as no percentage basis at all, so the height
        // never actually propagates down. flex/minHeight only take effect
        // when the parent is itself a flex container; harmless no-ops
        // otherwise. Found via a real browser run: a virtualized
        // <DataTable> inside one of these panels measured 0px height and
        // rendered no rows.
        flex: '1 1 0px',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        animation: 'var(--ai-tab-panel-animation, ai-fade-in 0.22s ease)',
      }}
    >
      {children}
    </div>
  );
};

TabStrip.Panel = TabPanel;

TabStrip.Tab.displayName = 'TabStrip.Tab';
TabStrip.Panel.displayName = 'TabStrip.Panel';
