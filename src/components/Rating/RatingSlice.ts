import { ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    rating: Partial<RatingSliceState>;
  }
}

/** @barrelExport */
export type RatingIconSize = 'sm' | 'md' | 'lg';
export type RatingGap = 'compact' | 'normal' | 'spacious';

export interface RatingSliceState {
  iconSize: RatingIconSize;
  gap: RatingGap;
}

export interface RatingCSSVariables extends Record<string, string> {
  '--ai-rating-icon-size': string;
  '--ai-rating-gap': string;
}

export const defaultRatingState: RatingSliceState = {
  iconSize: 'md',
  gap: 'compact',
};

const iconSizeMap: Record<RatingIconSize, string> = {
  sm: '1rem',
  md: '1.375rem',
  lg: '1.75rem',
};

const gapMap: Record<RatingGap, string> = {
  compact: '0.125rem',
  normal: '0.25rem',
  spacious: '0.5rem',
};

export function getRatingVariables(state: RatingSliceState = defaultRatingState): RatingCSSVariables {
  return {
    '--ai-rating-icon-size': iconSizeMap[state.iconSize] || iconSizeMap.md,
    '--ai-rating-gap': gapMap[state.gap] || gapMap.compact,
  };
}

export const RatingThemeSlice: ThemeSlice<RatingSliceState, RatingCSSVariables> = {
  id: 'rating',
  name: '⭐ Rating Icon Size & Gap',
  category: 'Form Controls',
  defaultState: defaultRatingState,
  getCSSVariables: getRatingVariables,
  fieldVars: {
    iconSize: ['--ai-rating-icon-size'],
    gap: ['--ai-rating-gap'],
  },
};
