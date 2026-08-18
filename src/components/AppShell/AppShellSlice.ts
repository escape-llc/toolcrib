import { ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    appshell: Partial<AppShellSliceState>;
  }
}

/**
 * AppShell.Header/.Main already referenced `--ai-appshell-header-padding`/
 * `--ai-appshell-main-padding` as CSS var fallbacks, but nothing ever
 * actually set them — this slice is what makes those variables real
 * instead of permanently falling through to their own hardcoded default.
 */
/** @barrelExport */
export type AppShellDensity = 'compact' | 'normal' | 'spacious';

export interface AppShellSliceState {
  density: AppShellDensity;
}

export interface AppShellCSSVariables extends Record<string, string> {
  '--ai-appshell-header-padding': string;
  '--ai-appshell-main-padding': string;
}

export const defaultAppShellState: AppShellSliceState = {
  density: 'normal',
};

const densityMap: Record<AppShellDensity, { header: string; main: string }> = {
  compact: { header: '0.5rem 1rem', main: '0.75rem' },
  normal: { header: '0.75rem 1.5rem', main: '1rem' },
  spacious: { header: '1.125rem 2rem', main: '1.5rem' },
};

export function getAppShellVariables(state: AppShellSliceState = defaultAppShellState): AppShellCSSVariables {
  const values = densityMap[state.density] || densityMap.normal;
  return {
    '--ai-appshell-header-padding': values.header,
    '--ai-appshell-main-padding': values.main,
  };
}

export const AppShellThemeSlice: ThemeSlice<AppShellSliceState, AppShellCSSVariables> = {
  id: 'appshell',
  name: '🖥️ App Shell Density',
  category: 'Containers',
  defaultState: defaultAppShellState,
  getCSSVariables: getAppShellVariables,
  fieldVars: {
    density: ['--ai-appshell-header-padding', '--ai-appshell-main-padding'],
  },
};
