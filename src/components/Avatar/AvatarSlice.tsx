import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    avatar: Partial<AvatarSliceState>;
  }
}

/** @barrelExport */
export type AvatarShape = 'circle' | 'rounded-square' | 'square';

export interface AvatarSliceState {
  shape: AvatarShape;
}

export interface AvatarCSSVariables extends Record<string, string> {
  '--ai-avatar-radius': string;
}

export const defaultAvatarState: AvatarSliceState = {
  shape: 'circle',
};

const radiusMap: Record<AvatarShape, string> = {
  circle: '50%',
  'rounded-square': 'var(--ai-radius-md, 0.375rem)',
  square: '0rem',
};

export function getAvatarVariables(state: AvatarSliceState = defaultAvatarState): AvatarCSSVariables {
  return {
    '--ai-avatar-radius': radiusMap[state.shape] || radiusMap.circle,
  };
}

export const AvatarThemeSlice: ThemeSlice<AvatarSliceState, AvatarCSSVariables> = {
  id: 'avatar',
  name: '🖼️ Avatar Shape',
  category: 'Data Display',
  defaultState: defaultAvatarState,
  getCSSVariables: getAvatarVariables,
  renderEditorControl: (state, onChange) => (
    <FieldRow
      label="Avatar Shape"
      value={state.shape}
      onChange={val => onChange({ ...state, shape: val as AvatarShape })}
      options={[
        { label: 'Circle', value: 'circle' },
        { label: 'Rounded Square', value: 'rounded-square' },
        { label: 'Square', value: 'square' },
      ]}
    />
  ),
  fieldVars: {
    shape: ['--ai-avatar-radius'],
  },
};
