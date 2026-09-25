import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    button: Partial<ButtonSliceState>;
  }
}

/** @barrelExport */
export type ButtonFontWeight = 'normal' | 'semibold' | 'bold';
export type ButtonIconGap = 'compact' | 'normal' | 'spacious';

export interface ButtonSliceState {
  fontWeight: ButtonFontWeight;
  iconGap: ButtonIconGap;
}

export interface ButtonCSSVariables extends Record<string, string> {
  '--ai-button-font-weight': string;
  '--ai-button-icon-gap': string;
}

export const defaultButtonState: ButtonSliceState = {
  fontWeight: 'semibold',
  iconGap: 'normal',
};

const fontWeightMap: Record<ButtonFontWeight, string> = {
  normal: '500',
  semibold: '600',
  bold: '700',
};

const iconGapMap: Record<ButtonIconGap, string> = {
  compact: '0.25rem',
  normal: '0.5rem',
  spacious: '0.75rem',
};

export function getButtonVariables(state: ButtonSliceState = defaultButtonState): ButtonCSSVariables {
  return {
    '--ai-button-font-weight': fontWeightMap[state.fontWeight] || fontWeightMap.semibold,
    '--ai-button-icon-gap': iconGapMap[state.iconGap] || iconGapMap.normal,
  };
}

export const ButtonThemeSlice: ThemeSlice<ButtonSliceState, ButtonCSSVariables> = {
  id: 'button',
  name: '🔘 Button Weight & Icon Spacing',
  category: 'Form Controls',
  defaultState: defaultButtonState,
  getCSSVariables: getButtonVariables,
  fieldVars: {
    fontWeight: ['--ai-button-font-weight'],
    iconGap: ['--ai-button-icon-gap'],
  },
};
