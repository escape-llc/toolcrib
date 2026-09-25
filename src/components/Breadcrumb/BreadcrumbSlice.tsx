import { type ThemeSlice } from '../../theme/slice';

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
  fieldVars: {
    gap: ['--ai-breadcrumb-gap'],
  },
};
