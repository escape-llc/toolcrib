import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    popup: Partial<PopupSliceState>;
  }
}

/** @barrelExport */
export type PopupShadowDepth = 'subtle' | 'elevated';
export type PopupBorderStyle = 'bordered' | 'borderless';

export interface PopupSliceState {
  shadowDepth: PopupShadowDepth;
  borderStyle: PopupBorderStyle;
}

export interface PopupCSSVariables extends Record<string, string> {
  '--ai-popup-shadow': string;
  '--ai-popup-border': string;
}

export const defaultPopupState: PopupSliceState = {
  shadowDepth: 'subtle',
  borderStyle: 'bordered',
};

const shadowMap: Record<PopupShadowDepth, string> = {
  subtle: '0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15)',
  elevated: '0 1.25rem 2.5rem -0.5rem rgba(0,0,0,0.28)',
};

export function getPopupVariables(state: PopupSliceState = defaultPopupState): PopupCSSVariables {
  return {
    '--ai-popup-shadow': shadowMap[state.shadowDepth] || shadowMap.subtle,
    '--ai-popup-border': state.borderStyle === 'borderless' ? 'none' : '0.0625rem solid var(--ai-border, #e5e7eb)',
  };
}

export const PopupThemeSlice: ThemeSlice<PopupSliceState, PopupCSSVariables> = {
  id: 'popup',
  name: '💬 Popup Shadow & Border',
  category: 'Overlays',
  defaultState: defaultPopupState,
  getCSSVariables: getPopupVariables,
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Popup Shadow Depth"
        value={state.shadowDepth}
        onChange={val => onChange({ ...state, shadowDepth: val as PopupShadowDepth })}
        options={[
          { label: 'Subtle', value: 'subtle' },
          { label: 'Elevated', value: 'elevated' },
        ]}
      />
      <FieldRow
        label="Popup Border Style"
        value={state.borderStyle}
        onChange={val => onChange({ ...state, borderStyle: val as PopupBorderStyle })}
        options={[
          { label: 'Bordered', value: 'bordered' },
          { label: 'Borderless', value: 'borderless' },
        ]}
      />
    </div>
  ),
  fieldVars: {
    shadowDepth: ['--ai-popup-shadow'],
    borderStyle: ['--ai-popup-border'],
  },
};
