import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

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
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Tree Indent"
        value={state.indent}
        onChange={val => onChange({ ...state, indent: val as TreeIndent })}
        options={[
          { label: 'Compact (1rem)', value: 'compact' },
          { label: 'Normal (1.25rem)', value: 'normal' },
          { label: 'Spacious (1.75rem)', value: 'spacious' },
        ]}
      />
      <FieldRow
        label="Tree Row Gap"
        value={state.itemGap}
        onChange={val => onChange({ ...state, itemGap: val as TreeItemGap })}
        options={[
          { label: 'None (Flush)', value: 'none' },
          { label: 'Compact (0.125rem)', value: 'compact' },
          { label: 'Normal (0.25rem)', value: 'normal' },
        ]}
      />
    </div>
  ),
  fieldVars: {
    indent: ['--ai-tree-indent'],
    itemGap: ['--ai-tree-item-gap'],
  },
};
