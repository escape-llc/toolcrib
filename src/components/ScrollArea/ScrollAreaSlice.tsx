import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    scrollArea: Partial<ScrollAreaSliceState>;
  }
}

/** @barrelExport */
export type ScrollbarWidth = 'thin' | 'normal' | 'thick';

/** @barrelExport */
export type ScrollAreaEdgeFade = 'none' | 'subtle' | 'strong';

export interface ScrollAreaSliceState {
  thumbWidth: ScrollbarWidth;
  /** How far the edges with more content to scroll fade out. */
  edgeFade: ScrollAreaEdgeFade;
}

export interface ScrollAreaCSSVariables extends Record<string, string> {
  '--ai-scrollarea-thumb-size': string;
  '--ai-scrollarea-fade-size': string;
}

export const defaultScrollAreaState: ScrollAreaSliceState = {
  thumbWidth: 'normal',
  edgeFade: 'subtle',
};

const widthMap: Record<ScrollbarWidth, string> = {
  thin: '0.375rem',
  normal: '0.5rem',
  thick: '0.75rem',
};

// 'none' is a 0px fade rather than a separate code path: the mask's
// min(fade, overflow) stops then collapse to the edge.
const fadeMap: Record<ScrollAreaEdgeFade, string> = {
  none: '0px',
  subtle: '1.5rem',
  strong: '3rem',
};

export function getScrollAreaVariables(state: ScrollAreaSliceState = defaultScrollAreaState): ScrollAreaCSSVariables {
  return {
    '--ai-scrollarea-thumb-size': widthMap[state.thumbWidth] || widthMap.normal,
    '--ai-scrollarea-fade-size': fadeMap[state.edgeFade] ?? fadeMap.subtle,
  };
}

export const ScrollAreaThemeSlice: ThemeSlice<ScrollAreaSliceState, ScrollAreaCSSVariables> = {
  id: 'scrollArea',
  name: '📜 Scrollbar Width',
  category: 'Containers',
  defaultState: defaultScrollAreaState,
  getCSSVariables: getScrollAreaVariables,
  fieldVars: {
    thumbWidth: ['--ai-scrollarea-thumb-size'],
    edgeFade: ['--ai-scrollarea-fade-size'],
  },
};
