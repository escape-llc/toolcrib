import { ThemeSlice } from '../../theme/slice';

/** @barrelExport */
export type ComboboxPadding = 'compact' | 'normal' | 'spacious';
export type ComboboxItemDensity = 'compact' | 'normal';

export interface ComboboxSliceState {
  padding: ComboboxPadding;
  itemDensity: ComboboxItemDensity;
}

export interface ComboboxCSSVariables extends Record<string, string> {
  '--ai-combobox-input-padding': string;
  '--ai-combobox-item-padding': string;
}

export const defaultComboboxState: ComboboxSliceState = {
  padding: 'normal',
  itemDensity: 'normal',
};

const inputPaddingMap: Record<ComboboxPadding, string> = {
  compact: '0.375rem 0.625rem',
  normal: '0.5rem 0.75rem',
  spacious: '0.75rem 1rem',
};

const itemPaddingMap: Record<ComboboxItemDensity, string> = {
  compact: '0.3125rem 0.625rem',
  normal: '0.4375rem 0.75rem',
};

export function getComboboxVariables(state: ComboboxSliceState = defaultComboboxState): ComboboxCSSVariables {
  return {
    '--ai-combobox-input-padding': inputPaddingMap[state.padding] || inputPaddingMap.normal,
    '--ai-combobox-item-padding': itemPaddingMap[state.itemDensity] || itemPaddingMap.normal,
  };
}

export const ComboboxThemeSlice: ThemeSlice<ComboboxSliceState, ComboboxCSSVariables> = {
  id: 'combobox',
  name: '🔍 Combobox Padding & Item Density',
  category: 'Form Controls',
  defaultState: defaultComboboxState,
  getCSSVariables: getComboboxVariables,
  fieldVars: {
    padding: ['--ai-combobox-input-padding'],
    itemDensity: ['--ai-combobox-item-padding'],
  },
};
