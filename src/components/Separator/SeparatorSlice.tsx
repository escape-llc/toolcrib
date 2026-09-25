import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    separator: Partial<SeparatorSliceState>;
  }
}

/** @barrelExport */
export type SeparatorThickness = 'thin' | 'normal' | 'thick';

export interface SeparatorSliceState {
  thickness: SeparatorThickness;
}

export interface SeparatorCSSVariables extends Record<string, string> {
  '--ai-separator-thickness': string;
}

export const defaultSeparatorState: SeparatorSliceState = {
  thickness: 'thin',
};

const thicknessMap: Record<SeparatorThickness, string> = {
  thin: '0.0625rem',
  normal: '0.125rem',
  thick: '0.1875rem',
};

export function getSeparatorVariables(state: SeparatorSliceState = defaultSeparatorState): SeparatorCSSVariables {
  return {
    '--ai-separator-thickness': thicknessMap[state.thickness] || thicknessMap.thin,
  };
}

export const SeparatorThemeSlice: ThemeSlice<SeparatorSliceState, SeparatorCSSVariables> = {
  id: 'separator',
  name: '➖ Separator Thickness',
  category: 'Layout Primitives',
  defaultState: defaultSeparatorState,
  getCSSVariables: getSeparatorVariables,
  fieldVars: {
    thickness: ['--ai-separator-thickness'],
  },
};
