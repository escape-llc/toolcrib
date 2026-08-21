import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    label: Partial<LabelSliceState>;
  }
}

/** @barrelExport */
export type LabelWeight = 'normal' | 'medium' | 'semibold' | 'bold';
export type LabelGap = 'compact' | 'normal' | 'spacious';

export interface LabelSliceState {
  weight: LabelWeight;
  gap: LabelGap;
}

export interface LabelCSSVariables extends Record<string, string> {
  '--ai-label-weight': string;
  '--ai-label-gap': string;
}

/**
 * Defaults to `weight: 'normal'` (unlike `FormField`'s own label, which
 * opts into `'semibold'` via `overrides`) so `<Label>` looks unchanged when
 * reused as `Checkbox`'s wrapping label, where the existing text was never
 * bold — and `gap: 'normal'` (0.5rem) for the same reason, matching
 * `Checkbox`'s own prior hand-rolled value exactly. `Switch`'s prior
 * wrapping label used a wider 0.625rem gap than `Checkbox`'s — a real,
 * deliberate-looking difference between the two, not an oversight — so
 * `Switch` opts into `gap: 'spacious'` via its own `overrides` instead of
 * changing this default, restoring its exact prior value the same way
 * `FormField` restores its own prior bold weight.
 */
export const defaultLabelState: LabelSliceState = {
  weight: 'normal',
  gap: 'normal',
};

const weightMap: Record<LabelWeight, string> = {
  normal: 'var(--ai-font-weight-normal, 400)',
  medium: 'var(--ai-font-weight-medium, 500)',
  semibold: 'var(--ai-font-weight-semibold, 600)',
  bold: 'var(--ai-font-weight-bold, 700)',
};

const gapMap: Record<LabelGap, string> = {
  compact: '0.375rem',
  normal: '0.5rem',
  spacious: '0.625rem',
};

export function getLabelVariables(state: LabelSliceState = defaultLabelState): LabelCSSVariables {
  return {
    '--ai-label-weight': weightMap[state.weight] || weightMap.normal,
    '--ai-label-gap': gapMap[state.gap] || gapMap.normal,
  };
}

export const LabelThemeSlice: ThemeSlice<LabelSliceState, LabelCSSVariables> = {
  id: 'label',
  name: '🏷️ Label Weight & Gap',
  category: 'Form Controls',
  defaultState: defaultLabelState,
  getCSSVariables: getLabelVariables,
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Label Font Weight"
        value={state.weight}
        onChange={val => onChange({ ...state, weight: val as LabelWeight })}
        options={[
          { label: 'Normal (400)', value: 'normal' },
          { label: 'Medium (500)', value: 'medium' },
          { label: 'Semibold (600)', value: 'semibold' },
          { label: 'Bold (700)', value: 'bold' },
        ]}
      />
      <FieldRow
        label="Label Gap"
        tooltip="Space between the label's own content and the control it wraps (e.g. Checkbox/Switch)"
        value={state.gap}
        onChange={val => onChange({ ...state, gap: val as LabelGap })}
        options={[
          { label: 'Compact (0.375rem)', value: 'compact' },
          { label: 'Normal (0.5rem)', value: 'normal' },
          { label: 'Spacious (0.625rem)', value: 'spacious' },
        ]}
      />
    </div>
  ),
  fieldVars: {
    weight: ['--ai-label-weight'],
    gap: ['--ai-label-gap'],
  },
};
