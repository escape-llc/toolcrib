import { ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    toggle: Partial<ToggleSliceState>;
  }
}

/** Shared by `<Toggle>` and `<ToggleGroup>` — both render the same button shape. */
/** @barrelExport */
export type TogglePadding = 'compact' | 'normal' | 'spacious';

export interface ToggleSliceState {
  padding: TogglePadding;
}

export interface ToggleCSSVariables extends Record<string, string> {
  '--ai-toggle-padding': string;
  '--ai-toggle-gap': string;
}

export const defaultToggleState: ToggleSliceState = {
  padding: 'normal',
};

const paddingMap: Record<TogglePadding, { padding: string; gap: string }> = {
  compact: { padding: '0.3125rem 0.5625rem', gap: '0.25rem' },
  normal: { padding: '0.4375rem 0.75rem', gap: '0.375rem' },
  spacious: { padding: '0.625rem 1rem', gap: '0.5rem' },
};

export function getToggleVariables(state: ToggleSliceState = defaultToggleState): ToggleCSSVariables {
  const values = paddingMap[state.padding] || paddingMap.normal;
  return {
    '--ai-toggle-padding': values.padding,
    '--ai-toggle-gap': values.gap,
  };
}

export const ToggleThemeSlice: ThemeSlice<ToggleSliceState, ToggleCSSVariables> = {
  id: 'toggle',
  name: '🔀 Toggle & Toggle Group Padding',
  category: 'Form Controls',
  defaultState: defaultToggleState,
  getCSSVariables: getToggleVariables,
  fieldVars: {
    padding: ['--ai-toggle-padding', '--ai-toggle-gap'],
  },
};
