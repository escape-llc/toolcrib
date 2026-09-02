import React, { type ReactNode } from 'react';
import { ThemeProvider, type ThemeProviderProps } from '../../theme/themeContext';
import { ToastProvider, type ToastProviderProps } from '../Toast/ToastContext';
import { ToastContainer } from '../Toast/Toast';
import { LocaleProvider, type LocaleStringsOverride } from '../Locale/LocaleContext';

export interface ToolcribProviderProps {
  children: ReactNode;
  /** Passed straight through to the underlying `<ThemeProvider>`. */
  theme?: Omit<ThemeProviderProps, 'children'>;
  /** Passed straight through to the underlying `<ToastProvider>`. */
  toast?: Omit<ToastProviderProps, 'children'>;
  /**
   * Passed straight through to the underlying `<LocaleProvider>`, as its
   * own `strings` prop — deliberately flattened here rather than nested
   * as `locale={{ strings: {...} }}` the way `theme`/`toast` above nest.
   * `<Calendar>` already has its own, unrelated `locale` prop (a BCP-47
   * tag for real date-name localization); reusing "locale" as a
   * `ToolcribProvider` prop name here too would be a discoverability
   * hazard even with no actual type collision, so this one prop is named
   * after what it actually is instead of after its sub-provider.
   */
  strings?: LocaleStringsOverride;
}

/**
 * Composes `<ThemeProvider>` > `<ToastProvider>` > `children` +
 * `<ToastContainer>` in the one correct nesting order — the same order
 * `CORE.md` §1 documents as required for manual wiring. Fixes the exact
 * failure mode manual wiring invites: omitting `<ToastContainer>` is a
 * silent failure (toasts fire on the bus and update state, but nothing
 * ever renders them), and this composition can't be gotten wrong because
 * there's no separate container to remember.
 *
 * Advanced composition (interleaving with a Router, Redux, or an Auth
 * context at a specific nesting depth) is still a legitimate reason to
 * reach for `<ThemeProvider>`/`<ToastProvider>`/`<ToastContainer>`
 * individually instead — they stay independently exported for exactly
 * that case. This component isn't a replacement API surface, it's the
 * default path for the common case.
 *
 * No `overrides`/`style`/`className` prop, no `ThemeSlice`, no z-index, no
 * event-bus emission, no resize awareness of its own — it's pure
 * composition, so the usual per-component ground rules don't apply here.
 * Deliberately has no `@manifest` tag (see `component-manifest.json`'s
 * precedent: `ThemeProvider`/`ToastProvider` don't have entries there
 * either — `CORE.md` §1's Root Setup prose is the documentation surface
 * for all three, not the generated component-manifest pipeline).
 * @barrelExport
 */
export const ToolcribProvider: React.FC<ToolcribProviderProps> = ({ children, theme, toast, strings }) => {
  return (
    <ThemeProvider {...theme}>
      <ToastProvider {...toast}>
        <LocaleProvider strings={strings}>
          {children}
          <ToastContainer />
        </LocaleProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};
