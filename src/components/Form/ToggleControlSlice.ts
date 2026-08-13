import { ThemeSlice } from '../../theme/slice';

/** Shared by `<Checkbox>` and `<Switch>` — both are small bounded toggle controls sized off the same scale. */
/** @barrelExport */
export type ToggleControlSize = 'sm' | 'md' | 'lg';

export interface ToggleControlSliceState {
  size: ToggleControlSize;
}

export interface ToggleControlCSSVariables extends Record<string, string> {
  '--ai-togglecontrol-checkbox-size': string;
  '--ai-togglecontrol-switch-width': string;
  '--ai-togglecontrol-switch-height': string;
  '--ai-togglecontrol-switch-thumb-size': string;
  '--ai-togglecontrol-switch-thumb-inset': string;
  '--ai-togglecontrol-switch-thumb-travel': string;
}

export const defaultToggleControlState: ToggleControlSliceState = {
  size: 'md',
};

const checkboxSizeMap: Record<ToggleControlSize, string> = {
  sm: '0.875rem',
  md: '1.125rem',
  lg: '1.375rem',
};

// width/height/thumb are rem numbers (not pre-formatted strings) here
// specifically so the thumb's travel distance — how far it slides on
// check — can be *computed* from them (trackWidth - thumb - 2*inset)
// instead of hardcoded separately and silently going out of sync with
// whichever size the width/height actually resolve to.
const switchSizeMap: Record<ToggleControlSize, { width: number; height: number; thumb: number; inset: number }> = {
  sm: { width: 2, height: 1.0625, thumb: 0.8125, inset: 0.125 },
  md: { width: 2.375, height: 1.25, thumb: 1, inset: 0.125 },
  lg: { width: 2.75, height: 1.5, thumb: 1.25, inset: 0.125 },
};

export function getToggleControlVariables(state: ToggleControlSliceState = defaultToggleControlState): ToggleControlCSSVariables {
  const s = switchSizeMap[state.size] || switchSizeMap.md;
  const travel = s.width - s.thumb - s.inset * 2;
  return {
    '--ai-togglecontrol-checkbox-size': checkboxSizeMap[state.size] || checkboxSizeMap.md,
    '--ai-togglecontrol-switch-width': `${s.width}rem`,
    '--ai-togglecontrol-switch-height': `${s.height}rem`,
    '--ai-togglecontrol-switch-thumb-size': `${s.thumb}rem`,
    '--ai-togglecontrol-switch-thumb-inset': `${s.inset}rem`,
    '--ai-togglecontrol-switch-thumb-travel': `${travel}rem`,
  };
}

export const ToggleControlThemeSlice: ThemeSlice<ToggleControlSliceState, ToggleControlCSSVariables> = {
  id: 'togglecontrol',
  name: '☑️ Checkbox & Switch Size',
  category: 'Form Controls',
  defaultState: defaultToggleControlState,
  getCSSVariables: getToggleControlVariables,
  fieldVars: {
    size: [
      '--ai-togglecontrol-checkbox-size',
      '--ai-togglecontrol-switch-width',
      '--ai-togglecontrol-switch-height',
      '--ai-togglecontrol-switch-thumb-size',
      '--ai-togglecontrol-switch-thumb-inset',
      '--ai-togglecontrol-switch-thumb-travel',
    ],
  },
};
