import { type ThemeSlice } from '../../theme/slice';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    modal: Partial<ModalSliceState>;
  }
}

/** @barrelExport */
export type ModalBackdropBlur = 'none' | 'subtle' | 'heavy';
export type ModalOverlayDarkness = 'light' | 'normal' | 'dark';
export type ModalNestedRecede = 'none' | 'subtle' | 'strong';

export interface ModalSliceState {
  backdropBlur: ModalBackdropBlur;
  overlayDarkness: ModalOverlayDarkness;
  /** How far a Modal shrinks back, per level, while a dialog is open on top of it. */
  nestedRecede: ModalNestedRecede;
}

export interface ModalCSSVariables extends Record<string, string> {
  '--ai-modal-backdrop-blur': string;
  '--ai-modal-overlay-bg': string;
  '--ai-modal-nested-scale-step': string;
}

export const defaultModalState: ModalSliceState = {
  backdropBlur: 'subtle',
  overlayDarkness: 'normal',
  nestedRecede: 'subtle',
};

// Scale lost per open child dialog: scale(1 - step * --nested-dialogs).
const recedeMap: Record<ModalNestedRecede, string> = {
  none: '0',
  subtle: '0.04',
  strong: '0.08',
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
    '--ai-modal-nested-scale-step': recedeMap[state.nestedRecede] ?? recedeMap.subtle,
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
    nestedRecede: ['--ai-modal-nested-scale-step'],
  },
};
