import { ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    modal: Partial<ModalSliceState>;
  }
}

/** @barrelExport */
export type ModalBackdropBlur = 'none' | 'subtle' | 'heavy';
export type ModalOverlayDarkness = 'light' | 'normal' | 'dark';

export interface ModalSliceState {
  backdropBlur: ModalBackdropBlur;
  overlayDarkness: ModalOverlayDarkness;
}

export interface ModalCSSVariables extends Record<string, string> {
  '--ai-modal-backdrop-blur': string;
  '--ai-modal-overlay-bg': string;
}

export const defaultModalState: ModalSliceState = {
  backdropBlur: 'subtle',
  overlayDarkness: 'normal',
};

const blurMap: Record<ModalBackdropBlur, string> = {
  none: '0rem',
  subtle: '0.1875rem',
  heavy: '0.5rem',
};

const overlayMap: Record<ModalOverlayDarkness, string> = {
  light: 'rgba(0, 0, 0, 0.3)',
  normal: 'rgba(0, 0, 0, 0.5)',
  dark: 'rgba(0, 0, 0, 0.7)',
};

export function getModalVariables(state: ModalSliceState = defaultModalState): ModalCSSVariables {
  return {
    '--ai-modal-backdrop-blur': blurMap[state.backdropBlur] || blurMap.subtle,
    '--ai-modal-overlay-bg': overlayMap[state.overlayDarkness] || overlayMap.normal,
  };
}

export const ModalThemeSlice: ThemeSlice<ModalSliceState, ModalCSSVariables> = {
  id: 'modal',
  name: '🪧 Modal Backdrop & Overlay',
  category: 'Overlays',
  defaultState: defaultModalState,
  getCSSVariables: getModalVariables,
  fieldVars: {
    backdropBlur: ['--ai-modal-backdrop-blur'],
    overlayDarkness: ['--ai-modal-overlay-bg'],
  },
};
