import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

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
  '--ai-appshell-sidebar-padding': string;
  '--ai-appshell-sidebar-width': string;
}

export const defaultAppShellState: AppShellSliceState = {
  density: 'normal',
};

const densityMap: Record<AppShellDensity, { header: string; main: string; sidebarPadding: string; sidebarWidth: string }> = {
  compact: { header: '0.5rem 1rem', main: '0.75rem', sidebarPadding: '0.75rem 0.5rem', sidebarWidth: '13rem' },
  normal: { header: '0.75rem 1.5rem', main: '1rem', sidebarPadding: '1rem 0.75rem', sidebarWidth: '16rem' },
  spacious: { header: '1.125rem 2rem', main: '1.5rem', sidebarPadding: '1.5rem 1rem', sidebarWidth: '18rem' },
};

export function getAppShellVariables(state: AppShellSliceState = defaultAppShellState): AppShellCSSVariables {
  const values = densityMap[state.density] || densityMap.normal;
  return {
    '--ai-appshell-header-padding': values.header,
    '--ai-appshell-main-padding': values.main,
    '--ai-appshell-sidebar-padding': values.sidebarPadding,
    '--ai-appshell-sidebar-width': values.sidebarWidth,
  };
}

export const AppShellThemeSlice: ThemeSlice<AppShellSliceState, AppShellCSSVariables> = {
  id: 'appshell',
  name: '🖥️ App Shell Density',
  category: 'Containers',
  defaultState: defaultAppShellState,
  getCSSVariables: getAppShellVariables,
  renderEditorControl: (state, onChange) => (
    <FieldRow
      label="App Shell Header & Main Density"
      tooltip="Since AppShell is meant to render once, this mostly exists for consistency with other components"
      value={state.density}
      onChange={val => onChange({ ...state, density: val as AppShellDensity })}
      options={[
        { label: 'Compact', value: 'compact' },
        { label: 'Normal', value: 'normal' },
        { label: 'Spacious', value: 'spacious' },
      ]}
    />
  ),
  fieldVars: {
    density: [
      '--ai-appshell-header-padding',
      '--ai-appshell-main-padding',
      '--ai-appshell-sidebar-padding',
      '--ai-appshell-sidebar-width',
    ],
  },
};
