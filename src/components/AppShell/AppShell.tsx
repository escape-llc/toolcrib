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
  return (
    <aside
      {...props}
      style={{
        flexShrink: 0,
        width: 'var(--ai-appshell-sidebar-width, 16rem)',
        overflow: 'auto',
        background: 'var(--ai-bg-surface)',
        borderRight: position === 'left' ? '0.0625rem solid var(--ai-border)' : undefined,
        borderLeft: position === 'right' ? '0.0625rem solid var(--ai-border)' : undefined,
        padding: paddingMode ? resolvePadding(paddingMode, 'lg') : 'var(--ai-appshell-sidebar-padding, 1rem 0.75rem)',
      }}
    >
      {children}
    </aside>
  );
};

AppShell.Header.displayName = 'AppShell.Header';
AppShell.Main.displayName = 'AppShell.Main';
AppShell.Sidebar.displayName = 'AppShell.Sidebar';
