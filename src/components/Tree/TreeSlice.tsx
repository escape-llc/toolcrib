import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    tree: Partial<TreeSliceState>;
  }
}

/** @barrelExport */
export type TreeIndent = 'compact' | 'normal' | 'spacious';
export type TreeItemGap = 'none' | 'compact' | 'normal';

export interface TreeSliceState {
  indent: TreeIndent;
  itemGap: TreeItemGap;
}

export interface TreeCSSVariables extends Record<string, string> {
  '--ai-tree-indent': string;
  '--ai-tree-item-gap': string;
}

export const defaultTreeState: TreeSliceState = {
  indent: 'normal',
  itemGap: 'none',
};

const indentMap: Record<TreeIndent, string> = {
  compact: '1rem',
  normal: '1.25rem',
  spacious: '1.75rem',
};

const gapMap: Record<TreeItemGap, string> = {
  none: '0',
  compact: '0.125rem',
  normal: '0.25rem',
};

export function getTreeVariables(state: TreeSliceState = defaultTreeState): TreeCSSVariables {
  return {
    '--ai-tree-indent': indentMap[state.indent] || indentMap.normal,
    '--ai-tree-item-gap': gapMap[state.itemGap] || gapMap.none,
  };
}

export const TreeThemeSlice: ThemeSlice<TreeSliceState, TreeCSSVariables> = {
  id: 'tree',
  name: '🌳 Tree Indent & Row Spacing',
  category: 'Data Display',
  defaultState: defaultTreeState,
  getCSSVariables: getTreeVariables,
  fieldVars: {
    indent: ['--ai-tree-indent'],
    itemGap: ['--ai-tree-item-gap'],
  },
};
