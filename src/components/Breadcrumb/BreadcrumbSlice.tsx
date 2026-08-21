import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    breadcrumb: Partial<BreadcrumbSliceState>;
  }
}

/** @barrelExport */
export type BreadcrumbGap = 'compact' | 'normal' | 'spacious';

export interface BreadcrumbSliceState {
  gap: BreadcrumbGap;
}

export interface BreadcrumbCSSVariables extends Record<string, string> {
  '--ai-breadcrumb-gap': string;
}

export const defaultBreadcrumbState: BreadcrumbSliceState = {
  gap: 'compact',
};

const gapMap: Record<BreadcrumbGap, string> = {
  compact: '0.375rem',
  normal: '0.5rem',
  spacious: '0.75rem',
};

export function getBreadcrumbVariables(state: BreadcrumbSliceState = defaultBreadcrumbState): BreadcrumbCSSVariables {
  return {
    '--ai-breadcrumb-gap': gapMap[state.gap] || gapMap.compact,
  };
}

export const BreadcrumbThemeSlice: ThemeSlice<BreadcrumbSliceState, BreadcrumbCSSVariables> = {
  id: 'breadcrumb',
  name: '🍞 Breadcrumb Item Gap',
  category: 'Data Display',
  defaultState: defaultBreadcrumbState,
  getCSSVariables: getBreadcrumbVariables,
  renderEditorControl: (state, onChange) => (
    <FieldRow
      label="Breadcrumb Item Gap"
      value={state.gap}
      onChange={val => onChange({ ...state, gap: val as BreadcrumbGap })}
      options={[
        { label: 'Compact (0.375rem)', value: 'compact' },
        { label: 'Normal (0.5rem)', value: 'normal' },
        { label: 'Spacious (0.75rem)', value: 'spacious' },
      ]}
    />
  ),
  fieldVars: {
    gap: ['--ai-breadcrumb-gap'],
  },
};
