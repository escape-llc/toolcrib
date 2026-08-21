import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    hoverCard: Partial<HoverCardSliceState>;
  }
}

/** @barrelExport */
export type HoverCardShadowDepth = 'subtle' | 'elevated';
export type HoverCardBorderStyle = 'bordered' | 'borderless';

export interface HoverCardSliceState {
  shadowDepth: HoverCardShadowDepth;
  borderStyle: HoverCardBorderStyle;
}

export interface HoverCardCSSVariables extends Record<string, string> {
  '--ai-hovercard-shadow': string;
  '--ai-hovercard-border': string;
}

export const defaultHoverCardState: HoverCardSliceState = {
  shadowDepth: 'subtle',
  borderStyle: 'bordered',
};

const shadowMap: Record<HoverCardShadowDepth, string> = {
  subtle: '0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15)',
  elevated: '0 1.25rem 2.5rem -0.5rem rgba(0,0,0,0.28)',
};

export function getHoverCardVariables(state: HoverCardSliceState = defaultHoverCardState): HoverCardCSSVariables {
  return {
    '--ai-hovercard-shadow': shadowMap[state.shadowDepth] || shadowMap.subtle,
    '--ai-hovercard-border': state.borderStyle === 'borderless' ? 'none' : '0.0625rem solid var(--ai-border, #e5e7eb)',
  };
}

export const HoverCardThemeSlice: ThemeSlice<HoverCardSliceState, HoverCardCSSVariables> = {
  id: 'hoverCard',
  name: '🪧 Hover Card Shadow & Border',
  category: 'Overlays',
  defaultState: defaultHoverCardState,
  getCSSVariables: getHoverCardVariables,
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Hover Card Shadow Depth"
        value={state.shadowDepth}
        onChange={val => onChange({ ...state, shadowDepth: val as HoverCardShadowDepth })}
        options={[
          { label: 'Subtle', value: 'subtle' },
          { label: 'Elevated', value: 'elevated' },
        ]}
      />
      <FieldRow
        label="Hover Card Border Style"
        value={state.borderStyle}
        onChange={val => onChange({ ...state, borderStyle: val as HoverCardBorderStyle })}
        options={[
          { label: 'Bordered', value: 'bordered' },
          { label: 'Borderless', value: 'borderless' },
        ]}
      />
    </div>
  ),
  fieldVars: {
    shadowDepth: ['--ai-hovercard-shadow'],
    borderStyle: ['--ai-hovercard-border'],
  },
};
