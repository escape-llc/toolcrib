import { ThemeSlice } from '../../theme/slice';

/** @barrelExport */
export type UIGroupOverlap = 'thin' | 'normal';

export interface UIGroupSliceState {
  overlap: UIGroupOverlap;
}

export interface UIGroupCSSVariables extends Record<string, string> {
  '--ai-uigroup-overlap': string;
}

export const defaultUIGroupState: UIGroupSliceState = {
  overlap: 'thin',
};

const overlapMap: Record<UIGroupOverlap, string> = {
  thin: '-0.0625rem',
  normal: '-0.125rem',
};

export function getUIGroupVariables(state: UIGroupSliceState = defaultUIGroupState): UIGroupCSSVariables {
  return {
    '--ai-uigroup-overlap': overlapMap[state.overlap] || overlapMap.thin,
  };
}

export const UIGroupThemeSlice: ThemeSlice<UIGroupSliceState, UIGroupCSSVariables> = {
  id: 'uigroup',
  name: '🔗 UIGroup Border Overlap',
  category: 'Layout Primitives',
  defaultState: defaultUIGroupState,
  getCSSVariables: getUIGroupVariables,
  fieldVars: {
    overlap: ['--ai-uigroup-overlap'],
  },
};
