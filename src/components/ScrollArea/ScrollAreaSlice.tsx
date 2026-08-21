import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    scrollArea: Partial<ScrollAreaSliceState>;
  }
}

/** @barrelExport */
export type ScrollbarWidth = 'thin' | 'normal' | 'thick';

export interface ScrollAreaSliceState {
  thumbWidth: ScrollbarWidth;
}

export interface ScrollAreaCSSVariables extends Record<string, string> {
  '--ai-scrollarea-thumb-size': string;
}

export const defaultScrollAreaState: ScrollAreaSliceState = {
  thumbWidth: 'normal',
};

const widthMap: Record<ScrollbarWidth, string> = {
  thin: '0.375rem',
  normal: '0.5rem',
  thick: '0.75rem',
};

export function getScrollAreaVariables(state: ScrollAreaSliceState = defaultScrollAreaState): ScrollAreaCSSVariables {
  return {
    '--ai-scrollarea-thumb-size': widthMap[state.thumbWidth] || widthMap.normal,
  };
}

export const ScrollAreaThemeSlice: ThemeSlice<ScrollAreaSliceState, ScrollAreaCSSVariables> = {
  id: 'scrollArea',
  name: '📜 Scrollbar Width',
  category: 'Containers',
  defaultState: defaultScrollAreaState,
  getCSSVariables: getScrollAreaVariables,
  renderEditorControl: (state, onChange) => (
    <FieldRow
      label="Scrollbar Width"
      value={state.thumbWidth}
      onChange={val => onChange({ ...state, thumbWidth: val as ScrollbarWidth })}
      options={[
        { label: 'Thin (0.375rem)', value: 'thin' },
        { label: 'Normal (0.5rem)', value: 'normal' },
        { label: 'Thick (0.75rem)', value: 'thick' },
      ]}
    />
  ),
  fieldVars: {
    thumbWidth: ['--ai-scrollarea-thumb-size'],
  },
};
