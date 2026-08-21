import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

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
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Alert Dialog Backdrop Blur"
        value={state.backdropBlur}
        onChange={val => onChange({ ...state, backdropBlur: val as AlertDialogBackdropBlur })}
        options={[
          { label: 'None', value: 'none' },
          { label: 'Subtle (0.1875rem)', value: 'subtle' },
          { label: 'Heavy (0.5rem)', value: 'heavy' },
        ]}
      />
      <FieldRow
        label="Alert Dialog Overlay Darkness"
        value={state.overlayDarkness}
        onChange={val => onChange({ ...state, overlayDarkness: val as AlertDialogOverlayDarkness })}
        options={[
          { label: 'Light (30% Black)', value: 'light' },
          { label: 'Normal (50% Black)', value: 'normal' },
          { label: 'Dark (70% Black)', value: 'dark' },
        ]}
      />
    </div>
  ),
  fieldVars: {
    backdropBlur: ['--ai-alertdialog-backdrop-blur'],
    overlayDarkness: ['--ai-alertdialog-overlay-bg'],
  },
};
