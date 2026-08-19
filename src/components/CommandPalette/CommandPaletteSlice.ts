import { ThemeSlice } from '../../theme/slice';

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
  fieldVars: {
    itemDensity: ['--ai-commandpalette-item-padding'],
    maxListHeight: ['--ai-commandpalette-max-list-height'],
  },
};
