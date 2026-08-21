import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    toolbar: Partial<ToolbarSliceState>;
  }
}

/** @barrelExport */
export type ToolbarSlotGap = 'compact' | 'normal' | 'spacious';

export interface ToolbarSliceState {
  slotGap: ToolbarSlotGap;
}

export interface ToolbarCSSVariables extends Record<string, string> {
  '--ai-toolbar-slot-gap': string;
}

export const defaultToolbarState: ToolbarSliceState = {
  slotGap: 'normal',
};

const gapMap: Record<ToolbarSlotGap, string> = {
  compact: '0.25rem',
  normal: '0.5rem',
  spacious: '0.875rem',
};

export function getToolbarVariables(state: ToolbarSliceState = defaultToolbarState): ToolbarCSSVariables {
  return {
    '--ai-toolbar-slot-gap': gapMap[state.slotGap] || gapMap.normal,
  };
}

export const ToolbarThemeSlice: ThemeSlice<ToolbarSliceState, ToolbarCSSVariables> = {
  id: 'toolbar',
  name: '🧰 Toolbar Slot Gap',
  category: 'Layout Primitives',
  defaultState: defaultToolbarState,
  getCSSVariables: getToolbarVariables,
  renderEditorControl: (state, onChange) => (
    <FieldRow
      label="Toolbar Slot Gap"
      value={state.slotGap}
      onChange={val => onChange({ ...state, slotGap: val as ToolbarSlotGap })}
      options={[
        { label: 'Compact (0.25rem)', value: 'compact' },
        { label: 'Normal (0.5rem)', value: 'normal' },
        { label: 'Spacious (0.875rem)', value: 'spacious' },
      ]}
    />
  ),
  fieldVars: {
    slotGap: ['--ai-toolbar-slot-gap'],
  },
};
