import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    toast: Partial<ToastSliceState>;
  }
}

/** @barrelExport */
export type ToastShadowDepth = 'subtle' | 'elevated';
export type ToastAccentStyle = 'stripe' | 'border-only';

export interface ToastSliceState {
  shadowDepth: ToastShadowDepth;
  accentStyle: ToastAccentStyle;
}

export interface ToastCSSVariables extends Record<string, string> {
  '--ai-toast-shadow': string;
  '--ai-toast-accent-width': string;
}

export const defaultToastState: ToastSliceState = {
  shadowDepth: 'subtle',
  accentStyle: 'stripe',
};

const shadowMap: Record<ToastShadowDepth, string> = {
  subtle: '0 0.625rem 0.9375rem -0.1875rem rgba(0,0,0,0.12), 0 0.25rem 0.375rem -0.125rem rgba(0,0,0,0.06)',
  elevated: '0 1.25rem 1.875rem -0.375rem rgba(0,0,0,0.22), 0 0.5rem 0.75rem -0.25rem rgba(0,0,0,0.12)',
};

export function getToastVariables(state: ToastSliceState = defaultToastState): ToastCSSVariables {
  return {
    '--ai-toast-shadow': shadowMap[state.shadowDepth] || shadowMap.subtle,
    '--ai-toast-accent-width': state.accentStyle === 'stripe' ? '0.3125rem' : '0rem',
  };
}

export const ToastThemeSlice: ThemeSlice<ToastSliceState, ToastCSSVariables> = {
  id: 'toast',
  name: '🔔 Toast Shadow & Accent Style',
  category: 'Overlays',
  defaultState: defaultToastState,
  getCSSVariables: getToastVariables,
  fieldVars: {
    shadowDepth: ['--ai-toast-shadow'],
    accentStyle: ['--ai-toast-accent-width'],
  },
};
