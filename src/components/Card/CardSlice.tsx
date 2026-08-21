import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    card: Partial<CardSliceState>;
  }
}

/** @barrelExport */
export type CardPadding = 'compact' | 'normal' | 'spacious';
export type CardHeaderStyle = 'flush' | 'bordered' | 'subtle-bg';

export interface CardSliceState {
  padding: CardPadding;
  headerStyle: CardHeaderStyle;
}

export interface CardCSSVariables extends Record<string, string> {
  '--ai-card-padding': string;
  '--ai-card-header-padding': string;
  '--ai-card-header-bg': string;
  '--ai-card-header-border': string;
}

export const defaultCardState: CardSliceState = {
  padding: 'normal',
  headerStyle: 'bordered',
};

const paddingMap: Record<CardPadding, string> = {
  compact: '0.75rem 1rem',
  normal: '1.25rem 1.5rem',
  spacious: '1.75rem 2.25rem',
};

export function getCardVariables(state: CardSliceState = defaultCardState): CardCSSVariables {
  const { padding, headerStyle } = state;

  let headerBg = 'transparent';
  let headerBorder = '0.0625rem solid var(--ai-border, #e5e7eb)';

  if (headerStyle === 'flush') {
    headerBorder = 'none';
  } else if (headerStyle === 'subtle-bg') {
    headerBg = 'var(--ai-bg-container, #f9fafb)';
  }

  return {
    '--ai-card-padding': paddingMap[padding] || paddingMap.normal,
    '--ai-card-header-padding': paddingMap[padding] || paddingMap.normal,
    '--ai-card-header-bg': headerBg,
    '--ai-card-header-border': headerBorder,
  };
}

export const CardThemeSlice: ThemeSlice<CardSliceState, CardCSSVariables> = {
  id: 'card',
  name: '🃏 Card Padding & Header Layout',
  category: 'Containers',
  defaultState: defaultCardState,
  getCSSVariables: getCardVariables,
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Card Padding"
        value={state.padding}
        onChange={val => onChange({ ...state, padding: val as CardPadding })}
        options={[
          { label: 'Compact (0.75rem 1rem)', value: 'compact' },
          { label: 'Normal (1.25rem 1.5rem)', value: 'normal' },
          { label: 'Spacious (1.75rem 2.25rem)', value: 'spacious' },
        ]}
      />
      <FieldRow
        label="Card Header Style"
        tooltip="Controls the header's background and bottom border across all Card components"
        value={state.headerStyle}
        onChange={val => onChange({ ...state, headerStyle: val as CardHeaderStyle })}
        options={[
          { label: 'Flush (No Border)', value: 'flush' },
          { label: 'Bordered (Bottom Border)', value: 'bordered' },
          { label: 'Subtle Background (Tinted Header)', value: 'subtle-bg' },
        ]}
      />
    </div>
  ),
  fieldVars: {
    padding: ['--ai-card-padding', '--ai-card-header-padding'],
    headerStyle: ['--ai-card-header-bg', '--ai-card-header-border'],
  },
};
