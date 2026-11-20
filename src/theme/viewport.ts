import { type ThemeSlice } from './slice';

declare module './sliceStateMap' {
  interface ToolcribSliceStateMap {
    viewport: Partial<ViewportSliceState>;
  }
}

/**
 * How the viewport insets are derived. `auto` reads the platform: the
 * Window Controls Overlay title bar (`env(titlebar-area-height)`) and the
 * device safe areas (`env(safe-area-inset-*)`), all 0 in a plain browser,
 * with the four rem values as a minimum under them.
 * `manual` uses only the four rem values. `none` disables insets.
 * @barrelExport
 */
export type ViewportMode = 'auto' | 'manual' | 'none';

/** @barrelExport */
export interface ViewportSliceState {
  mode: ViewportMode;
  /** Distance in rem full-window overlays and popups stay below the viewport top (an app's own title bar). The value in manual mode, a minimum under the platform's own in auto. */
  top: number;
  /** Manual mode: distance in rem from the viewport's right edge. */
  right: number;
  /** Manual mode: distance in rem from the viewport's bottom edge. */
  bottom: number;
  /** Manual mode: distance in rem from the viewport's left edge. */
  left: number;
}

export interface ViewportCSSVariables extends Record<string, string> {
  '--ai-viewport-inset-top': string;
  '--ai-viewport-inset-right': string;
  '--ai-viewport-inset-bottom': string;
  '--ai-viewport-inset-left': string;
}

export const defaultViewportState: ViewportSliceState = {
  mode: 'auto',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

/** The four inset variable names, in top/right/bottom/left order. */
export const VIEWPORT_INSET_VARS = {
  top: '--ai-viewport-inset-top',
  right: '--ai-viewport-inset-right',
  bottom: '--ai-viewport-inset-bottom',
  left: '--ai-viewport-inset-left',
} as const;

/**
 * The `var()` reads full-window overlays position with. The `0px` fallback
 * keeps everything unchanged outside a provider.
 * @barrelExport
 */
export const VIEWPORT_INSET = {
  top: 'var(--ai-viewport-inset-top, 0px)',
  right: 'var(--ai-viewport-inset-right, 0px)',
  bottom: 'var(--ai-viewport-inset-bottom, 0px)',
  left: 'var(--ai-viewport-inset-left, 0px)',
} as const;

/**
 * `top`/`right`/`bottom`/`left` set to the viewport insets, for a
 * `position: fixed` layer that fills the window inside them.
 * @barrelExport
 */
export const VIEWPORT_EDGES = { ...VIEWPORT_INSET };

const clampRem = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);

export function getViewportVariables(state: ViewportSliceState = defaultViewportState): ViewportCSSVariables {
  // A persisted/imported state saved before this slice existed has no mode: treat as auto.
  const mode = state.mode === 'manual' || state.mode === 'none' ? state.mode : 'auto';
  if (mode === 'manual') {
    return {
      '--ai-viewport-inset-top': `${clampRem(state.top)}rem`,
      '--ai-viewport-inset-right': `${clampRem(state.right)}rem`,
      '--ai-viewport-inset-bottom': `${clampRem(state.bottom)}rem`,
      '--ai-viewport-inset-left': `${clampRem(state.left)}rem`,
    };
  }
  if (mode === 'none') {
    return {
      '--ai-viewport-inset-top': '0rem',
      '--ai-viewport-inset-right': '0rem',
      '--ai-viewport-inset-bottom': '0rem',
      '--ai-viewport-inset-left': '0rem',
    };
  }
  // The rem values act as a minimum under the platform's own value, so one
  // theme (auto + top 2.5rem) covers Window Controls Overlay, where env()
  // reports the title bar, and a macOS inset-traffic-lights window, where
  // no env value exists.
  return {
    '--ai-viewport-inset-top': `max(env(titlebar-area-height, 0px), env(safe-area-inset-top, 0px), ${clampRem(state.top)}rem)`,
    '--ai-viewport-inset-right': `max(env(safe-area-inset-right, 0px), ${clampRem(state.right)}rem)`,
    '--ai-viewport-inset-bottom': `max(env(safe-area-inset-bottom, 0px), ${clampRem(state.bottom)}rem)`,
    '--ai-viewport-inset-left': `max(env(safe-area-inset-left, 0px), ${clampRem(state.left)}rem)`,
  };
}

export const ViewportThemeSlice: ThemeSlice<ViewportSliceState, ViewportCSSVariables> = {
  id: 'viewport',
  name: '🖥️ Viewport (Title Bar & Safe Areas)',
  category: 'Layout Primitives',
  defaultState: defaultViewportState,
  getCSSVariables: getViewportVariables,
  // Every field can change every variable (mode switches all four), so each lists all of them.
  fieldVars: {
    mode: ['--ai-viewport-inset-top', '--ai-viewport-inset-right', '--ai-viewport-inset-bottom', '--ai-viewport-inset-left'],
    top: ['--ai-viewport-inset-top'],
    right: ['--ai-viewport-inset-right'],
    bottom: ['--ai-viewport-inset-bottom'],
    left: ['--ai-viewport-inset-left'],
  },
};
