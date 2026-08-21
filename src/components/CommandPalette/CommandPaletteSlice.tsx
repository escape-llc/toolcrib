import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    commandpalette: Partial<CommandPaletteSliceState>;
  }
}

/** @barrelExport */
export type CommandPaletteItemDensity = 'compact' | 'normal';

export interface CommandPaletteSliceState {
  itemDensity: CommandPaletteItemDensity;
  /** Max height of the scrollable item list before it scrolls internally. */
  maxListHeight: string;
}

export interface CommandPaletteCSSVariables extends Record<string, string> {
  '--ai-commandpalette-item-padding': string;
  '--ai-commandpalette-max-list-height': string;
}

export const defaultCommandPaletteState: CommandPaletteSliceState = {
  itemDensity: 'normal',
  maxListHeight: '21.875rem',
};

const itemPaddingMap: Record<CommandPaletteItemDensity, string> = {
  compact: '0.3125rem 0.625rem',
  normal: '0.4375rem 0.75rem',
};

export function getCommandPaletteVariables(
  state: CommandPaletteSliceState = defaultCommandPaletteState
): CommandPaletteCSSVariables {
  return {
    '--ai-commandpalette-item-padding': itemPaddingMap[state.itemDensity] || itemPaddingMap.normal,
    '--ai-commandpalette-max-list-height': state.maxListHeight,
  };
}

export const CommandPaletteThemeSlice: ThemeSlice<CommandPaletteSliceState, CommandPaletteCSSVariables> = {
  id: 'commandpalette',
  name: '⚙️ Command Palette Density & List Height',
  category: 'Overlays',
  defaultState: defaultCommandPaletteState,
  getCSSVariables: getCommandPaletteVariables,
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Command Palette Item Density"
        value={state.itemDensity}
        onChange={val => onChange({ ...state, itemDensity: val as CommandPaletteItemDensity })}
        options={[
          { label: 'Compact', value: 'compact' },
          { label: 'Normal', value: 'normal' },
        ]}
      />
      {/* maxListHeight is a free-form rem string on the wire (not a closed
          union in state) — offered here as a small preset row, the same
          shape DrawerSlice's `width` field already uses for a CSS value
          that's free-form on the wire but closed in state. */}
      <FieldRow
        label="Command Palette Max List Height"
        tooltip="How tall the scrollable item list can grow before it scrolls internally"
        value={state.maxListHeight}
        onChange={val => onChange({ ...state, maxListHeight: val })}
        options={[
          { label: 'Compact (15rem)', value: '15rem' },
          { label: 'Normal (21.875rem)', value: '21.875rem' },
          { label: 'Tall (30rem)', value: '30rem' },
        ]}
      />
    </div>
  ),
  fieldVars: {
    itemDensity: ['--ai-commandpalette-item-padding'],
    maxListHeight: ['--ai-commandpalette-max-list-height'],
  },
};
