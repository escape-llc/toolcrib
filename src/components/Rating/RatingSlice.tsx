import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

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
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Rating Icon Size"
        value={state.iconSize}
        onChange={val => onChange({ ...state, iconSize: val as RatingIconSize })}
        options={[
          { label: 'Small (1rem)', value: 'sm' },
          { label: 'Medium (1.375rem)', value: 'md' },
          { label: 'Large (1.75rem)', value: 'lg' },
        ]}
      />
      <FieldRow
        label="Rating Icon Gap"
        value={state.gap}
        onChange={val => onChange({ ...state, gap: val as RatingGap })}
        options={[
          { label: 'Compact (0.125rem)', value: 'compact' },
          { label: 'Normal (0.25rem)', value: 'normal' },
          { label: 'Spacious (0.5rem)', value: 'spacious' },
        ]}
      />
    </div>
  ),
  fieldVars: {
    iconSize: ['--ai-rating-icon-size'],
    gap: ['--ai-rating-gap'],
  },
};
