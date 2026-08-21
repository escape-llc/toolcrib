import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    sidebar: Partial<SidebarSliceState>;
  }
}

/** @barrelExport */
export type SidebarItemGap = 'compact' | 'normal';

export interface SidebarSliceState {
  itemGap: SidebarItemGap;
}

export interface SidebarCSSVariables extends Record<string, string> {
  '--ai-sidebar-item-gap': string;
}

export const defaultSidebarState: SidebarSliceState = {
  itemGap: 'compact',
};

const gapMap: Record<SidebarItemGap, string> = {
  compact: '0.125rem',
  normal: '0.375rem',
};

export function getSidebarVariables(state: SidebarSliceState = defaultSidebarState): SidebarCSSVariables {
  return {
    '--ai-sidebar-item-gap': gapMap[state.itemGap] || gapMap.compact,
  };
}

export const SidebarThemeSlice: ThemeSlice<SidebarSliceState, SidebarCSSVariables> = {
  id: 'sidebar',
  name: '🧭 Sidebar Nav Item Spacing',
  category: 'Containers',
  defaultState: defaultSidebarState,
  getCSSVariables: getSidebarVariables,
  renderEditorControl: (state, onChange) => (
    <FieldRow
      label="Sidebar Nav Item Spacing"
      value={state.itemGap}
      onChange={val => onChange({ ...state, itemGap: val as SidebarItemGap })}
      options={[
        { label: 'Compact (0.125rem)', value: 'compact' },
        { label: 'Normal (0.375rem)', value: 'normal' },
      ]}
    />
  ),
  fieldVars: {
    itemGap: ['--ai-sidebar-item-gap'],
  },
};
