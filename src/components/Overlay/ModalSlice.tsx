import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

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
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Modal Backdrop Blur"
        value={state.backdropBlur}
        onChange={val => onChange({ ...state, backdropBlur: val as ModalBackdropBlur })}
        options={[
          { label: 'None', value: 'none' },
          { label: 'Subtle (0.1875rem)', value: 'subtle' },
          { label: 'Heavy (0.5rem)', value: 'heavy' },
        ]}
      />
      <FieldRow
        label="Modal Overlay Darkness"
        value={state.overlayDarkness}
        onChange={val => onChange({ ...state, overlayDarkness: val as ModalOverlayDarkness })}
        options={[
          { label: 'Light (30% Black)', value: 'light' },
          { label: 'Normal (50% Black)', value: 'normal' },
          { label: 'Dark (70% Black)', value: 'dark' },
        ]}
      />
    </div>
  ),
  fieldVars: {
    backdropBlur: ['--ai-modal-backdrop-blur'],
    overlayDarkness: ['--ai-modal-overlay-bg'],
  },
};
