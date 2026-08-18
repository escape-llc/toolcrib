import { ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    alertdialog: Partial<AlertDialogSliceState>;
  }
}

/** Same shape as ModalSlice — AlertDialog is structurally the same overlay, kept as its own slice per the one-slice-per-component convention rather than sharing Modal's. */
/** @barrelExport */
export type AlertDialogBackdropBlur = 'none' | 'subtle' | 'heavy';
export type AlertDialogOverlayDarkness = 'light' | 'normal' | 'dark';

export interface AlertDialogSliceState {
  backdropBlur: AlertDialogBackdropBlur;
  overlayDarkness: AlertDialogOverlayDarkness;
}

export interface AlertDialogCSSVariables extends Record<string, string> {
  '--ai-alertdialog-backdrop-blur': string;
  '--ai-alertdialog-overlay-bg': string;
}

export const defaultAlertDialogState: AlertDialogSliceState = {
  backdropBlur: 'subtle',
  overlayDarkness: 'normal',
};

const blurMap: Record<AlertDialogBackdropBlur, string> = {
  none: '0rem',
  subtle: '0.1875rem',
  heavy: '0.5rem',
};

const overlayMap: Record<AlertDialogOverlayDarkness, string> = {
  light: 'rgba(0, 0, 0, 0.3)',
  normal: 'rgba(0, 0, 0, 0.5)',
  dark: 'rgba(0, 0, 0, 0.7)',
};

export function getAlertDialogVariables(state: AlertDialogSliceState = defaultAlertDialogState): AlertDialogCSSVariables {
  return {
    '--ai-alertdialog-backdrop-blur': blurMap[state.backdropBlur] || blurMap.subtle,
    '--ai-alertdialog-overlay-bg': overlayMap[state.overlayDarkness] || overlayMap.normal,
  };
}

export const AlertDialogThemeSlice: ThemeSlice<AlertDialogSliceState, AlertDialogCSSVariables> = {
  id: 'alertdialog',
  name: '⚠️ Alert Dialog Backdrop & Overlay',
  category: 'Overlays',
  defaultState: defaultAlertDialogState,
  getCSSVariables: getAlertDialogVariables,
  fieldVars: {
    backdropBlur: ['--ai-alertdialog-backdrop-blur'],
    overlayDarkness: ['--ai-alertdialog-overlay-bg'],
  },
};
