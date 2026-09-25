import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    select: Partial<SelectSliceState>;
  }
}

/** @barrelExport */
export type SelectPadding = 'compact' | 'normal' | 'spacious';
export type SelectItemDensity = 'compact' | 'normal';

export interface SelectSliceState {
  padding: SelectPadding;
  itemDensity: SelectItemDensity;
}

export interface SelectCSSVariables extends Record<string, string> {
  '--ai-select-trigger-padding': string;
  '--ai-select-item-padding': string;
}

export const defaultSelectState: SelectSliceState = {
  padding: 'normal',
  itemDensity: 'normal',
};

const triggerPaddingMap: Record<SelectPadding, string> = {
  compact: '0.375rem 0.625rem',
  normal: '0.5rem 0.75rem',
  spacious: '0.75rem 1rem',
};

const itemPaddingMap: Record<SelectItemDensity, string> = {
  compact: '0.3125rem 0.625rem',
  normal: '0.4375rem 0.75rem',
};

export function getSelectVariables(state: SelectSliceState = defaultSelectState): SelectCSSVariables {
  return {
    '--ai-select-trigger-padding': triggerPaddingMap[state.padding] || triggerPaddingMap.normal,
    '--ai-select-item-padding': itemPaddingMap[state.itemDensity] || itemPaddingMap.normal,
  };
}

export const SelectThemeSlice: ThemeSlice<SelectSliceState, SelectCSSVariables> = {
  id: 'select',
  name: '🔽 Select Padding & Item Density',
  category: 'Form Controls',
  defaultState: defaultSelectState,
  getCSSVariables: getSelectVariables,
  fieldVars: {
    padding: ['--ai-select-trigger-padding'],
    itemDensity: ['--ai-select-item-padding'],
  },
};
