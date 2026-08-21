import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    collapsible: Partial<CollapsibleSliceState>;
  }
}

/** @barrelExport */
export type CollapsiblePadding = 'compact' | 'normal' | 'spacious';

export interface CollapsibleSliceState {
  padding: CollapsiblePadding;
}

export interface CollapsibleCSSVariables extends Record<string, string> {
  '--ai-collapsible-header-padding': string;
  '--ai-collapsible-content-padding': string;
}

export const defaultCollapsibleState: CollapsibleSliceState = {
  padding: 'normal',
};

const paddingMap: Record<CollapsiblePadding, { header: string; content: string }> = {
  compact: { header: '0.625rem 0.875rem', content: '0.75rem 0.875rem' },
  normal: { header: '0.875rem 1.125rem', content: '1rem 1.125rem' },
  spacious: { header: '1.125rem 1.5rem', content: '1.375rem 1.5rem' },
};

export function getCollapsibleVariables(state: CollapsibleSliceState = defaultCollapsibleState): CollapsibleCSSVariables {
  const values = paddingMap[state.padding] || paddingMap.normal;
  return {
    '--ai-collapsible-header-padding': values.header,
    '--ai-collapsible-content-padding': values.content,
  };
}

export const CollapsibleThemeSlice: ThemeSlice<CollapsibleSliceState, CollapsibleCSSVariables> = {
  id: 'collapsible',
  name: '📂 Collapsible Padding',
  category: 'Containers',
  defaultState: defaultCollapsibleState,
  getCSSVariables: getCollapsibleVariables,
  renderEditorControl: (state, onChange) => (
    <FieldRow
      label="Collapsible Header & Content Padding"
      value={state.padding}
      onChange={val => onChange({ ...state, padding: val as CollapsiblePadding })}
      options={[
        { label: 'Compact', value: 'compact' },
        { label: 'Normal', value: 'normal' },
        { label: 'Spacious', value: 'spacious' },
      ]}
    />
  ),
  fieldVars: {
    padding: ['--ai-collapsible-header-padding', '--ai-collapsible-content-padding'],
  },
};
