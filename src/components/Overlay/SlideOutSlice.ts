import { ThemeSlice } from '../../theme/slice';

/** @barrelExport */
export type SlideOutWidth = 'sm' | 'md' | 'lg' | '25vw' | '33vw' | '50vw' | '75vw' | 'full';
export type SlideOutPosition = 'right' | 'left' | 'top' | 'bottom';
export type SlideOutBackdrop = 'none' | 'subtle' | 'heavy';
export type SlideOutHeaderMargin = 'none' | 'compact' | 'normal' | 'spacious' | 'detached';

export interface SlideOutSliceState {
  width: SlideOutWidth;
  position: SlideOutPosition;
  backdropBlur: SlideOutBackdrop;
  headerMargin: SlideOutHeaderMargin;
}

export interface SlideOutCSSVariables extends Record<string, string> {
  '--ai-slideout-width': string;
  '--ai-slideout-duration': string;
  '--ai-slideout-easing': string;
  '--ai-slideout-backdrop-blur': string;
  '--ai-slideout-header-margin': string;
  '--ai-slideout-header-border-radius': string;
}

export const defaultSlideOutState: SlideOutSliceState = {
  width: 'md',
  position: 'right',
  backdropBlur: 'subtle',
  headerMargin: 'none',
};

const widthMap: Record<SlideOutWidth, string> = {
  sm: '20rem',
  md: '26rem',
  lg: '36rem',
  '25vw': '25vw',
  '33vw': '33.333vw',
  '50vw': '50vw',
  '75vw': '75vw',
  full: '100vw',
};

const blurMap: Record<SlideOutBackdrop, string> = {
  none: '0rem',
  subtle: '0.125rem',
  heavy: '0.5rem',
};

const headerMarginMap: Record<SlideOutHeaderMargin, string> = {
  none: '0',
  compact: '0 0 0.5rem 0',
  normal: '0 0 1rem 0',
  spacious: '0 0 1.5rem 0',
  detached: '0.75rem 0.75rem 0.5rem 0.75rem',
};

export function getSlideOutVariables(state: SlideOutSliceState = defaultSlideOutState): SlideOutCSSVariables {
  const { width, backdropBlur, headerMargin } = state;

  return {
    '--ai-slideout-width': widthMap[width] || widthMap.md,
    '--ai-slideout-duration': 'var(--ai-transition-duration-normal, 250ms)',
    '--ai-slideout-easing': 'var(--ai-transition-easing, cubic-bezier(0.4, 0, 0.2, 1))',
    '--ai-slideout-backdrop-blur': blurMap[backdropBlur] || blurMap.subtle,
    '--ai-slideout-header-margin': headerMarginMap[headerMargin] || headerMarginMap.none,
    '--ai-slideout-header-border-radius': headerMargin === 'detached' ? 'var(--ai-radius-md, 0.375rem)' : '0',
  };
}

export const SlideOutThemeSlice: ThemeSlice<SlideOutSliceState, SlideOutCSSVariables> = {
  id: 'slideout',
  name: '🪟 SlideOut Drawer & Retract Dynamics',
  defaultState: defaultSlideOutState,
  getCSSVariables: getSlideOutVariables,
};
