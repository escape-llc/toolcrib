/* eslint-disable react-hooks/rules-of-hooks -- AppShell.Sidebar below is a real
   component (the documented Component.Slot = (props) => {...} pattern this
   repo's AGENTS.md manifest section describes for slot discovery), calling
   useContext/useState/useMemo internally. The lint rule's naming heuristic
   only recognizes a bare PascalCase identifier as a valid component name, not
   an `AppShell.Sidebar =` assignment target, so it misreads this as a plain
   non-component function calling hooks illegally. Confirmed false positive,
   not a real bug -- this renders and tests correctly today. Scoped to just
   this one rule for this file; every other react-hooks rule still applies. */
import React, { type ReactNode, createContext, useContext } from 'react';
import { type PaddingMode, resolvePadding } from '../../theme/padding';
import { type StyleFreeAttributes, warnIfLegacyStyleProps } from '../../theme/safeProps';
import { getSparseVariables } from '../../theme/slice';
import { AppShellThemeSlice, type AppShellSliceState } from './AppShellSlice';

// AppShell.Sidebar draws a divider border on the side facing AppShell.Main
// -- which physical side that is depends entirely on the parent
// AppShell's own `layout` prop (row vs. row-reverse), not anything
// Sidebar knows about itself. A small local context, the same shape as
// this codebase's other "component needs contextual awareness of a
// choice it doesn't own itself" cases (LayoutDomainContext,
// StyleDomainContext), rather than threading a prop through.
const SidebarPositionContext = createContext<'left' | 'right'>('left');

// The reverse direction of the context above: AppShell.Sidebar's own
// <aside> has always sized itself independently of whatever it contains
// -- a fixed `width` with no idea a <Sidebar> inside it can collapse
// itself down to an icon-only rail. Without this, collapsing <Sidebar>
// only shrinks the nav *inside* the aside, leaving the aside itself at
// its full width and a large dead strip of empty background between the
// now-narrow rail and AppShell.Main (reported directly, from a real
// screenshot). `reportCollapsed` lets a <Sidebar> (or anything else that
// wants to) tell its own ancestor <AppShell.Sidebar> to resize alongside
// it; harmless no-op for a consumer that puts something else entirely
// inside AppShell.Sidebar, or renders <Sidebar> outside of it.
const SidebarCollapseContext = createContext<{ reportCollapsed: (collapsed: boolean) => void } | undefined>(undefined);

/**
 * For a component (typically `<Sidebar>`) that wants its own collapsed/
 * expanded state to also resize an ancestor `<AppShell.Sidebar>`, if one
 * is present. Safe to call unconditionally -- resolves to a no-op outside
 * an `<AppShell.Sidebar>`. Exported for a consumer building their own
 * custom collapsible nav rail to plug into the same mechanism `<Sidebar>`
 * itself uses, not just for this toolkit's internal use.
 * @barrelExport
 */
export function useReportSidebarCollapsed(collapsed: boolean): void {
  const ctx = useContext(SidebarCollapseContext);
  React.useEffect(() => {
    ctx?.reportCollapsed(collapsed);
  }, [ctx, collapsed]);
}

// Matches Sidebar.tsx's own COLLAPSED_WIDTH literal -- kept in sync by
// hand (same lightweight pattern as this codebase's other small
// cross-file constants, e.g. e2e/nav.ts's own TAB_GROUP comment) rather
// than importing across component folders for one shared literal.
const SIDEBAR_COLLAPSED_WIDTH = '3.5rem';

/**
 * Props for the root `<AppShell>` container — the full-viewport frame every
 * app built with this toolkit starts from.
 *
 * Slot sub-components: `AppShell.Header`, `AppShell.Sidebar`, `AppShell.Main`.
 */
export interface AppShellProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
  /**
   * `'default'` stacks children vertically (the original behavior).
   * `'sidebar-left'`/`'sidebar-right'` separate out `AppShell.Header` (if
   * present, stays full-width on top) and lay out everything else —
   * `AppShell.Sidebar` and `AppShell.Main`, written in either order — as a
   * row, with the sidebar on the named side.
   * @default 'default'
   */
  layout?: 'default' | 'sidebar-left' | 'sidebar-right';
  /** Per-instance override for Header/Main/Sidebar padding density. Since AppShell is meant to render once, this mostly exists for consistency with other components — the global Theme Editor control is the more typical way to change this. */
  overrides?: Partial<AppShellSliceState>;
}

/** Props for the `<AppShell.Header>` slot. Renders as a `<header>` with themed padding, background, and a bottom border. */
export interface AppShellHeaderProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Overrides the default padding using the theme padding token scale. */
  paddingMode?: PaddingMode;
}

/** Props for the `<AppShell.Main>` slot. Renders as a `<main>` that fills remaining vertical space. */
export interface AppShellMainProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Overrides the default padding using the theme padding token scale. */
  paddingMode?: PaddingMode;
}

/** Props for the `<AppShell.Sidebar>` slot. Renders as an `<aside>` with a fixed themed width, only meaningful when the parent `<AppShell>`'s `layout` is `'sidebar-left'`/`'sidebar-right'`. */
export interface AppShellSidebarProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Overrides the default padding using the theme padding token scale. */
  paddingMode?: PaddingMode;
}

/**
 * @manifest Full-viewport root layout frame with Header, Sidebar, and Main slots — the top-level wrapper for an entire app
 * @manifestConstraints Intended to be rendered once, at the root of the component tree
 * @manifestCategory Containers
 * @manifestAntiPatternAvoid Hand-roll a full-viewport app layout frame with header/sidebar/main regions and manual sidebar-collapse state
 * @manifestAntiPatternInstead Use `<AppShell layout="sidebar-left"|"sidebar-right">` + `<AppShell.Sidebar>` — icon-only collapse and the correct divider border side come for free
 */
export const AppShell: React.FC<AppShellProps> & {
  Header: React.FC<AppShellHeaderProps>;
  Main: React.FC<AppShellMainProps>;
  Sidebar: React.FC<AppShellSidebarProps>;
} = ({ children, layout = 'default', overrides, ...props }) => {
  warnIfLegacyStyleProps(props, 'AppShell');
  const appShellVars = getSparseVariables(AppShellThemeSlice, overrides ?? {});
  const rootStyle: React.CSSProperties = {
    height: '100vh',
    width: '100vw',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--ai-bg-primary)',
    color: 'var(--ai-text-primary)',
    ...appShellVars,
  };

  if (layout === 'default') {
    return (
      <div {...props} style={rootStyle}>
        {children}
      </div>
    );
  }

  const childArray = React.Children.toArray(children);
  const headerChild = childArray.find(c => React.isValidElement(c) && c.type === AppShell.Header);
  const bodyChildren = childArray.filter(c => c !== headerChild);

  return (
    <div {...props} style={rootStyle}>
      {headerChild}
      <SidebarPositionContext.Provider value={layout === 'sidebar-left' ? 'left' : 'right'}>
        <div
          style={{
            display: 'flex',
            flexDirection: layout === 'sidebar-left' ? 'row' : 'row-reverse',
            flex: '1 1 0px',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {bodyChildren}
        </div>
      </SidebarPositionContext.Provider>
    </div>
  );
};

AppShell.Header = ({ children, paddingMode, ...props }) => {
  warnIfLegacyStyleProps(props, 'AppShell.Header');
  return (
    <header
      {...props}
      style={{
        padding: paddingMode ? resolvePadding(paddingMode, 'lg') : 'var(--ai-appshell-header-padding, 0.75rem 1.5rem)',
        background: 'var(--ai-bg-surface)',
        borderBottom: '0.0625rem solid var(--ai-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        // flexWrap + gap, not overflow/nowrap: a header's typical two
        // children (a title block, an actions cluster) each have their own
        // natural content width, and neither this element nor a plain flex
        // row gives either child anywhere to shrink to below that — so at
        // a narrow viewport they don't compress, they overlap. Wrapping
        // instead lets the actions cluster drop to its own line below the
        // title once they no longer fit side by side, which is what a
        // real header needs regardless of what a given consumer puts in
        // it. No visual change for anything that already fits on one line
        // — this only activates once content actually doesn't fit.
        flexWrap: 'wrap',
        gap: '0.75rem',
        flexShrink: 0,
      }}
    >
      {children}
    </header>
  );
};

AppShell.Main = ({ children, paddingMode, ...props }) => {
  warnIfLegacyStyleProps(props, 'AppShell.Main');
  return (
    <main
      {...props}
      style={{
        flex: '1 1 0px',
        width: '100%',
        minHeight: 0,
        overflow: 'hidden',
        padding: paddingMode ? resolvePadding(paddingMode, 'lg') : 'var(--ai-appshell-main-padding, 1rem)',
      }}
    >
      {children}
    </main>
  );
};

AppShell.Sidebar = ({ children, paddingMode, ...props }) => {
  warnIfLegacyStyleProps(props, 'AppShell.Sidebar');
  const position = useContext(SidebarPositionContext);
  const [collapsed, setCollapsed] = React.useState(false);
  const contextValue = React.useMemo(() => ({ reportCollapsed: setCollapsed }), []);

  return (
    <aside
      {...props}
      style={{
        flexShrink: 0,
        width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : 'var(--ai-appshell-sidebar-width, 16rem)',
        // Same transition value as Sidebar's own inner rail (Sidebar.tsx)
        // -- both widths need to animate in lockstep, or the rail visibly
        // outruns (or lags) the aside's own edge during the collapse. The
        // var alone, not `width ${var}` -- see Sidebar.tsx's own comment
        // on why prepending a property name in front of
        // --ai-transition-normal produces invalid, silently-dropped CSS.
        transition: 'var(--ai-transition-normal, all 0.2s cubic-bezier(0.4, 0, 0.2, 1))',
        overflowX: 'hidden',
        overflowY: 'auto',
        background: 'var(--ai-bg-surface)',
        borderRight: position === 'left' ? '0.0625rem solid var(--ai-border)' : undefined,
        borderLeft: position === 'right' ? '0.0625rem solid var(--ai-border)' : undefined,
        // Horizontal padding drops to 0 while collapsed, regardless of
        // paddingMode -- the aside's own content-box width has to equal
        // SIDEBAR_COLLAPSED_WIDTH exactly, matching the fixed collapsed
        // width <Sidebar> itself renders at, or its normal horizontal
        // padding eats into that fixed budget and the inner nav (still
        // its own full COLLAPSED_WIDTH wide) overflows its now-narrower
        // parent -- invisible before this component set overflowX to
        // 'auto' (a barely-there scrollbar was the only sign), a hard
        // right-edge crop on every icon once it became 'hidden' instead
        // (reported directly, from a real screenshot).
        padding: collapsed ? '1rem 0' : paddingMode ? resolvePadding(paddingMode, 'lg') : 'var(--ai-appshell-sidebar-padding, 1rem 0.75rem)',
      }}
    >
      <SidebarCollapseContext.Provider value={contextValue}>{children}</SidebarCollapseContext.Provider>
    </aside>
  );
};

AppShell.Header.displayName = 'AppShell.Header';
AppShell.Main.displayName = 'AppShell.Main';
AppShell.Sidebar.displayName = 'AppShell.Sidebar';
