import { ThemeSlice } from '../../theme/slice';

/** @barrelExport */
export type RadioGroupGap = 'compact' | 'normal' | 'spacious';
export type RadioGroupDotSize = 'sm' | 'md' | 'lg';

export interface RadioGroupSliceState {
  gap: RadioGroupGap;
  dotSize: RadioGroupDotSize;
}

export interface RadioGroupCSSVariables extends Record<string, string> {
  '--ai-radiogroup-gap-horizontal': string;
  '--ai-radiogroup-gap-vertical': string;
  '--ai-radiogroup-dot-size': string;
  '--ai-radiogroup-dot-inner-size': string;
}

export const defaultRadioGroupState: RadioGroupSliceState = {
  gap: 'normal',
  dotSize: 'md',
};

const gapMap: Record<RadioGroupGap, { horizontal: string; vertical: string }> = {
  compact: { horizontal: '0.75rem', vertical: '0.375rem' },
  normal: { horizontal: '1.25rem', vertical: '0.625rem' },
  spacious: { horizontal: '1.75rem', vertical: '1rem' },
};

const dotSizeMap: Record<RadioGroupDotSize, { outer: string; inner: string }> = {
  sm: { outer: '0.875rem', inner: '0.375rem' },
  md: { outer: '1.125rem', inner: '0.5rem' },
  lg: { outer: '1.375rem', inner: '0.625rem' },
};

export function getRadioGroupVariables(state: RadioGroupSliceState = defaultRadioGroupState): RadioGroupCSSVariables {
  const gap = gapMap[state.gap] || gapMap.normal;
  const dot = dotSizeMap[state.dotSize] || dotSizeMap.md;
  return {
    '--ai-radiogroup-gap-horizontal': gap.horizontal,
    '--ai-radiogroup-gap-vertical': gap.vertical,
    '--ai-radiogroup-dot-size': dot.outer,
    '--ai-radiogroup-dot-inner-size': dot.inner,
  };
}

export const RadioGroupThemeSlice: ThemeSlice<RadioGroupSliceState, RadioGroupCSSVariables> = {
  id: 'radiogroup',
  name: '🔘 Radio Group Spacing & Dot Size',
  category: 'Form Controls',
  defaultState: defaultRadioGroupState,
  getCSSVariables: getRadioGroupVariables,
  fieldVars: {
    gap: ['--ai-radiogroup-gap-horizontal', '--ai-radiogroup-gap-vertical'],
    dotSize: ['--ai-radiogroup-dot-size', '--ai-radiogroup-dot-inner-size'],
  },
};
