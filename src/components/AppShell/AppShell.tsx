import React, { ReactNode } from 'react';
import { PaddingMode, resolvePadding } from '../../theme/padding';
import { StyleFreeAttributes, warnIfLegacyStyleProps } from '../../theme/safeProps';
import { getSparseVariables } from '../../theme/slice';
import { AppShellThemeSlice, AppShellSliceState } from './AppShellSlice';

/**
 * Props for the root `<AppShell>` container — the full-viewport frame every
 * app built with this toolkit starts from.
 *
 * Slot sub-components: `AppShell.Header`, `AppShell.Main`.
 */
export interface AppShellProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Per-instance override for Header/Main padding density. Since AppShell is meant to render once, this mostly exists for consistency with other components — the global Theme Editor control is the more typical way to change this. */
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

/**
 * @manifest Full-viewport root layout frame with Header and Main slots — the top-level wrapper for an entire app
 * @manifestConstraints Intended to be rendered once, at the root of the component tree
 * @manifestCategory Containers
 */
export const AppShell: React.FC<AppShellProps> & {
  Header: React.FC<AppShellHeaderProps>;
  Main: React.FC<AppShellMainProps>;
} = ({ children, overrides, ...props }) => {
  warnIfLegacyStyleProps(props, 'AppShell');
  const appShellVars = getSparseVariables(AppShellThemeSlice, overrides ?? {});
  return (
    <div
      {...props}
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--ai-bg-primary)',
        color: 'var(--ai-text-primary)',
        ...appShellVars,
      }}
    >
      {children}
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

AppShell.Header.displayName = 'AppShell.Header';
AppShell.Main.displayName = 'AppShell.Main';
