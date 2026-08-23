import { type ThemeSlice } from './slice';
import { FieldRow } from '../components/ThemeEditor/ThemeEditorFieldRow';
import { Slider } from '../components/Form/Slider';

declare module './sliceStateMap' {
  interface ToolcribSliceStateMap {
    typography: Partial<TypographySliceState>;
  }
}

/** @barrelExport */
export type FontFamilyPreset = 'system' | 'serif' | 'monospace';

export interface TypographySliceState {
  fontFamily: FontFamilyPreset;
  /** Base font size in px — controls all rem-based scaling throughout the toolkit. */
  masterFontSize: number;
  /**
   * Unitless line-height multiplier for body/prose text (e.g. `Card.Content`).
   * Controls reading density — NOT a general-purpose line-height. Icon
   * glyphs wrapped via `ICON_WRAPPER_STYLE` (`src/theme/iconWrapperStyle.ts`)
   * deliberately stay hardcoded at `1` regardless of this value — that's a
   * structural fix (clipping a fallback font's taller line box) not a
   * density preference, and must not vary with it.
   */
  baseLineHeight: number;
}

export interface TypographyCSSVariables extends Record<string, string> {
  '--ai-font-family': string;
  '--ai-master-font-size': string;
  '--ai-line-height': string;
  '--ai-control-font-size-sm': string;
  '--ai-control-font-size-md': string;
  '--ai-control-font-size-lg': string;
}

// The standardized sm/md/lg font-size scale every sized interactive control
// (Button, Input, Select, Combobox, ToggleGroup, ...) reads from — see
// `src/theme/controlSize.ts`. Ratios of masterFontSize rather than an
// independent field: `lg` is 100% of the master size, `md` 87.5%, `sm` 75%
// (the exact numbers this scale already used before it moved here, just now
// expressed as ratios so the whole scale tracks one slider instead of
// three). Consumers reference the CSS variable with its own literal-rem
// fallback (`var(--ai-control-font-size-sm, 0.75rem)`), so `size` still
// resolves correctly even outside a mounted `ToolcribProvider`.
const CONTROL_FONT_SIZE_RATIO = { sm: 0.75, md: 0.875, lg: 1 } as const;

export const defaultTypographyState: TypographySliceState = {
  fontFamily: 'system',
  masterFontSize: 16,
  baseLineHeight: 1.5,
};

// 'system' matches the stack the demo previously hardcoded directly in its
// own index.css, unconditionally — preserved here as the default so moving
// font-family into the theme system doesn't change anyone's default look.
const fontFamilyMap: Record<FontFamilyPreset, string> = {
  system: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
  monospace: '"SF Mono", "Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
};

export function getTypographyVariables(state: TypographySliceState = defaultTypographyState): TypographyCSSVariables {
  return {
    '--ai-font-family': fontFamilyMap[state.fontFamily] || fontFamilyMap.system,
    '--ai-master-font-size': `${state.masterFontSize}px`,
    '--ai-line-height': `${state.baseLineHeight}`,
    '--ai-control-font-size-sm': `${state.masterFontSize * CONTROL_FONT_SIZE_RATIO.sm}px`,
    '--ai-control-font-size-md': `${state.masterFontSize * CONTROL_FONT_SIZE_RATIO.md}px`,
    '--ai-control-font-size-lg': `${state.masterFontSize * CONTROL_FONT_SIZE_RATIO.lg}px`,
  };
}

export const TypographyThemeSlice: ThemeSlice<TypographySliceState, TypographyCSSVariables> = {
  id: 'typography',
  name: '🔤 Typography (Font Family, Size & Line Height)',
  category: 'Layout Primitives',
  defaultState: defaultTypographyState,
  getCSSVariables: getTypographyVariables,
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Font Family"
        tooltip="Sets --ai-font-family, consumed anywhere a component uses fontFamily: 'inherit' up to :root"
        value={state.fontFamily}
        onChange={val => onChange({ ...state, fontFamily: val as FontFamilyPreset })}
        options={[
          { label: 'System (Inter / system-ui)', value: 'system' },
          { label: 'Serif (Georgia / Times)', value: 'serif' },
          { label: 'Monospace (SF Mono / Consolas)', value: 'monospace' },
        ]}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
          <span>Master Font Size (rem Base)</span>
          <span>{state.masterFontSize}px</span>
        </div>
        <Slider
          ariaLabel="Master Font Size"
          min={12}
          max={24}
          value={state.masterFontSize}
          onChange={val => onChange({ ...state, masterFontSize: val })}
          commitOnRelease
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
          <span>Line Height (Text Density)</span>
          <span>{state.baseLineHeight.toFixed(1)}</span>
        </div>
        <Slider
          ariaLabel="Line Height"
          min={1.2}
          max={2}
          step={0.1}
          value={state.baseLineHeight}
          onChange={val => onChange({ ...state, baseLineHeight: val })}
          commitOnRelease
        />
      </div>
    </div>
  ),
  fieldVars: {
    fontFamily: ['--ai-font-family'],
    masterFontSize: ['--ai-master-font-size', '--ai-control-font-size-sm', '--ai-control-font-size-md', '--ai-control-font-size-lg'],
    baseLineHeight: ['--ai-line-height'],
  },
};
