import { ThemeSlice } from '../../theme/slice';

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
  fieldVars: {
    itemGap: ['--ai-sidebar-item-gap'],
  },
};
