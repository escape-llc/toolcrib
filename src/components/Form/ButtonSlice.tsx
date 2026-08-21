import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

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
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Button Font Weight"
        value={state.fontWeight}
        onChange={val => onChange({ ...state, fontWeight: val as ButtonFontWeight })}
        options={[
          { label: 'Normal (500)', value: 'normal' },
          { label: 'Semibold (600)', value: 'semibold' },
          { label: 'Bold (700)', value: 'bold' },
        ]}
      />
      <FieldRow
        label="Button Icon Gap"
        value={state.iconGap}
        onChange={val => onChange({ ...state, iconGap: val as ButtonIconGap })}
        options={[
          { label: 'Compact (0.25rem)', value: 'compact' },
          { label: 'Normal (0.5rem)', value: 'normal' },
          { label: 'Spacious (0.75rem)', value: 'spacious' },
        ]}
      />
    </div>
  ),
  fieldVars: {
    fontWeight: ['--ai-button-font-weight'],
    iconGap: ['--ai-button-icon-gap'],
  },
};
