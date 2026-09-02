import { type ThemeSlice } from './slice';
import { FieldRow } from '../components/ThemeEditor/ThemeEditorFieldRow';
import { Slider } from '../components/Form/Slider';

declare module './sliceStateMap' {
  interface ToolcribSliceStateMap {
    livingColor: Partial<LivingColorSliceState>;
  }
}

/** @barrelExport */
export type LivingColorEnabled = 'on' | 'off';

export interface LivingColorSliceState {
  enabled: LivingColorEnabled;
  /** Seconds per full breathe/pulse cycle. */
  duration: number;
}

export interface LivingColorCSSVariables extends Record<string, string> {
  '--ai-living-color-duration': string;
  '--ai-living-color-easing': string;
}

export const defaultLivingColorState: LivingColorSliceState = {
  enabled: 'on',
  duration: 6,
};

/**
 * Deliberately mints its own `--ai-living-color-*` scale rather than
 * reusing `--ai-transition-*` — that scale is documented (animationKeyframes.ts)
 * as tuned for 100-500ms discrete state transitions, not multi-second
 * ambient loops, and this codebase has a real, twice-independently-occurring
 * bug class from treating an already-complete `--ai-transition-*` shorthand
 * string as if it were a bare duration to concatenate into.
 */
export function getLivingColorVariables(
  state: LivingColorSliceState = defaultLivingColorState
): LivingColorCSSVariables {
  const { enabled, duration } = state;

  if (enabled === 'off') {
    // Same early-return idiom as getAnimationVariables's preset:'none'
    // branch: 0s/linear makes the keyframe cycle instantaneous/invisible
    // without needing a second gating variable or JS add/remove-class logic.
    return {
      '--ai-living-color-duration': '0s',
      '--ai-living-color-easing': 'linear',
    };
  }

  return {
    '--ai-living-color-duration': `${duration}s`,
    '--ai-living-color-easing': 'ease-in-out',
  };
}

export const LivingColorThemeSlice: ThemeSlice<LivingColorSliceState, LivingColorCSSVariables> = {
  id: 'livingColor',
  name: '🌊 Living Color (Ambient Breathe & Glow)',
  category: 'Layout Primitives',
  defaultState: defaultLivingColorState,
  getCSSVariables: getLivingColorVariables,
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Living Color"
        tooltip="Enables the ambient color-breathe/glow-pulse loop for elements opted in via .ai-living-accent / .ai-living-glow"
        value={state.enabled}
        onChange={val => onChange({ ...state, enabled: val as LivingColorEnabled })}
        options={[
          { label: 'On', value: 'on' },
          { label: 'Off', value: 'off' },
        ]}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 'var(--ai-font-weight-semibold, 600)' }}>
          <span>Breathe Duration</span>
          <span>{state.duration}s</span>
        </div>
        <Slider
          value={state.duration}
          min={2}
          max={20}
          step={1}
          onChange={val => onChange({ ...state, duration: val })}
          disabled={state.enabled === 'off'}
        />
      </div>
    </div>
  ),
};
