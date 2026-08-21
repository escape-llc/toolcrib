import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    viewer: Partial<ViewerSliceState>;
  }
}

/** @barrelExport */
export type ViewerNavButtonSize = 'sm' | 'md' | 'lg';
export type ViewerCaptionStyle = 'plain' | 'contrast';

export interface ViewerSliceState {
  navButtonSize: ViewerNavButtonSize;
  /** `'plain'` sits flush with the surrounding surface; `'contrast'` gets a dark bar + light text, for viewers hosted over busy/light media. */
  captionStyle: ViewerCaptionStyle;
}

export interface ViewerCSSVariables extends Record<string, string> {
  '--ai-viewer-nav-button-size': string;
  '--ai-viewer-caption-bg': string;
  '--ai-viewer-caption-color': string;
}

export const defaultViewerState: ViewerSliceState = {
  navButtonSize: 'md',
  captionStyle: 'plain',
};

const navButtonSizeMap: Record<ViewerNavButtonSize, string> = {
  sm: '2rem',
  md: '2.75rem',
  lg: '3.5rem',
};

export function getViewerVariables(state: ViewerSliceState = defaultViewerState): ViewerCSSVariables {
  const isContrast = state.captionStyle === 'contrast';
  return {
    '--ai-viewer-nav-button-size': navButtonSizeMap[state.navButtonSize] || navButtonSizeMap.md,
    '--ai-viewer-caption-bg': isContrast ? 'rgba(0, 0, 0, 0.75)' : 'transparent',
    '--ai-viewer-caption-color': isContrast ? '#ffffff' : 'var(--ai-text-primary, #111827)',
  };
}

export const ViewerThemeSlice: ThemeSlice<ViewerSliceState, ViewerCSSVariables> = {
  id: 'viewer',
  name: '🖼️ Viewer Nav Buttons & Caption',
  category: 'Overlays',
  defaultState: defaultViewerState,
  getCSSVariables: getViewerVariables,
  fieldVars: {
    navButtonSize: ['--ai-viewer-nav-button-size'],
    captionStyle: ['--ai-viewer-caption-bg', '--ai-viewer-caption-color'],
  },
};
