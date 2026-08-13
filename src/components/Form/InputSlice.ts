import { ThemeSlice } from '../../theme/slice';

/** Shared by `<Input>` and `<Textarea>` — both are plain bordered text fields with the same visual knobs. */
/** @barrelExport */
export type InputPadding = 'compact' | 'normal' | 'spacious';
export type InputBorderWidth = 'thin' | 'normal' | 'thick';

export interface InputSliceState {
  padding: InputPadding;
  borderWidth: InputBorderWidth;
}

export interface InputCSSVariables extends Record<string, string> {
  '--ai-input-padding': string;
  '--ai-input-border-width': string;
}

export const defaultInputState: InputSliceState = {
  padding: 'normal',
  borderWidth: 'thin',
};

const paddingMap: Record<InputPadding, string> = {
  compact: '0.375rem 0.625rem',
  normal: '0.5rem 0.75rem',
  spacious: '0.75rem 1rem',
};

const borderWidthMap: Record<InputBorderWidth, string> = {
  thin: '0.0625rem',
  normal: '0.125rem',
  thick: '0.1875rem',
};

export function getInputVariables(state: InputSliceState = defaultInputState): InputCSSVariables {
  return {
    '--ai-input-padding': paddingMap[state.padding] || paddingMap.normal,
    '--ai-input-border-width': borderWidthMap[state.borderWidth] || borderWidthMap.thin,
  };
}

export const InputThemeSlice: ThemeSlice<InputSliceState, InputCSSVariables> = {
  id: 'input',
  name: '📝 Input & Textarea Padding & Border',
  category: 'Form Controls',
  defaultState: defaultInputState,
  getCSSVariables: getInputVariables,
  fieldVars: {
    padding: ['--ai-input-padding'],
    borderWidth: ['--ai-input-border-width'],
  },
};
