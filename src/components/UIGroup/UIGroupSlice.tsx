import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    uigroup: Partial<UIGroupSliceState>;
  }
}

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
  renderEditorControl: (state, onChange) => (
    <FieldRow
      label="UIGroup Border Overlap"
      tooltip="Global only — this shared, singleton stylesheet has no per-instance scoping to override"
      value={state.overlap}
      onChange={val => onChange({ ...state, overlap: val as UIGroupOverlap })}
      options={[
        { label: 'Thin (-0.0625rem)', value: 'thin' },
        { label: 'Normal (-0.125rem)', value: 'normal' },
      ]}
    />
  ),
  fieldVars: {
    overlap: ['--ai-uigroup-overlap'],
  },
};
