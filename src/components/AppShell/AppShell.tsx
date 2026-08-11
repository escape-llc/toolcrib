import React, { ReactNode } from 'react';
import { PaddingMode, resolvePadding } from '../../theme/padding';
import { StyleFreeAttributes, warnIfLegacyStyleProps } from '../../theme/safeProps';

/**
 * Props for the root `<AppShell>` container — the full-viewport frame every
 * app built with this toolkit starts from.
 *
 * Slot sub-components: `AppShell.Header`, `AppShell.Main`.
 */
export interface AppShellProps extends StyleFreeAttributes<HTMLDivElement> {
  children: ReactNode;
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
 */
export const AppShell: React.FC<AppShellProps> & {
  Header: React.FC<AppShellHeaderProps>;
  Main: React.FC<AppShellMainProps>;
} = ({ children, ...props }) => {
  warnIfLegacyStyleProps(props, 'AppShell');
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
