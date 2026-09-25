import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    drawer: Partial<DrawerSliceState>;
  }
}

/** @barrelExport */
export type DrawerWidth = 'sm' | 'md' | 'lg' | '25vw' | '33vw' | '50vw' | '75vw' | 'full';
export type DrawerPosition = 'right' | 'left' | 'top' | 'bottom';
export type DrawerBackdrop = 'none' | 'subtle' | 'heavy';
export type DrawerHeaderMargin = 'none' | 'compact' | 'normal' | 'spacious' | 'detached';

export interface DrawerSliceState {
  width: DrawerWidth;
  position: DrawerPosition;
  backdropBlur: DrawerBackdrop;
  headerMargin: DrawerHeaderMargin;
}

export interface DrawerCSSVariables extends Record<string, string> {
  '--ai-drawer-width': string;
  '--ai-drawer-duration': string;
  '--ai-drawer-easing': string;
  '--ai-drawer-backdrop-blur': string;
  '--ai-drawer-header-margin': string;
  '--ai-drawer-header-border-radius': string;
}

export const defaultDrawerState: DrawerSliceState = {
  width: 'md',
  position: 'right',
  backdropBlur: 'subtle',
  headerMargin: 'none',
};

const widthMap: Record<DrawerWidth, string> = {
  sm: '20rem',
  md: '26rem',
  lg: '36rem',
  '25vw': '25vw',
  '33vw': '33.333vw',
  '50vw': '50vw',
  '75vw': '75vw',
  full: '100vw',
};

const blurMap: Record<DrawerBackdrop, string> = {
  none: '0rem',
  subtle: '0.125rem',
  heavy: '0.5rem',
};

const headerMarginMap: Record<DrawerHeaderMargin, string> = {
  none: '0',
  compact: '0 0 0.5rem 0',
  normal: '0 0 1rem 0',
  spacious: '0 0 1.5rem 0',
  detached: '0.75rem 0.75rem 0.5rem 0.75rem',
};

export function getDrawerVariables(state: DrawerSliceState = defaultDrawerState): DrawerCSSVariables {
  const { width, backdropBlur, headerMargin } = state;

  return {
    '--ai-drawer-width': widthMap[width] || widthMap.md,
    '--ai-drawer-duration': 'var(--ai-transition-duration-normal, 250ms)',
    '--ai-drawer-easing': 'var(--ai-transition-easing, cubic-bezier(0.4, 0, 0.2, 1))',
    '--ai-drawer-backdrop-blur': blurMap[backdropBlur] || blurMap.subtle,
    '--ai-drawer-header-margin': headerMarginMap[headerMargin] || headerMarginMap.none,
    '--ai-drawer-header-border-radius': headerMargin === 'detached' ? 'var(--ai-radius-md, 0.375rem)' : '0',
  };
}

export const DrawerThemeSlice: ThemeSlice<DrawerSliceState, DrawerCSSVariables> = {
  id: 'drawer',
  name: '🪟 Drawer & Retract Dynamics',
  category: 'Overlays',
  defaultState: defaultDrawerState,
  getCSSVariables: getDrawerVariables,
};
