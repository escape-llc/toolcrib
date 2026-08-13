import { ThemeSlice } from '../../theme/slice';

/** @barrelExport */
export type DropdownMenuShadowDepth = 'subtle' | 'elevated';
export type DropdownMenuItemDensity = 'compact' | 'normal';

export interface DropdownMenuSliceState {
  shadowDepth: DropdownMenuShadowDepth;
  itemDensity: DropdownMenuItemDensity;
}

export interface DropdownMenuCSSVariables extends Record<string, string> {
  '--ai-dropdownmenu-shadow': string;
  '--ai-dropdownmenu-item-padding': string;
}

export const defaultDropdownMenuState: DropdownMenuSliceState = {
  shadowDepth: 'subtle',
  itemDensity: 'normal',
};

const shadowMap: Record<DropdownMenuShadowDepth, string> = {
  subtle: '0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15)',
  elevated: '0 1.25rem 2.5rem -0.5rem rgba(0,0,0,0.28)',
};

const itemPaddingMap: Record<DropdownMenuItemDensity, string> = {
  compact: '0.3125rem 0.625rem',
  normal: '0.4375rem 0.75rem',
};

export function getDropdownMenuVariables(state: DropdownMenuSliceState = defaultDropdownMenuState): DropdownMenuCSSVariables {
  return {
    '--ai-dropdownmenu-shadow': shadowMap[state.shadowDepth] || shadowMap.subtle,
    '--ai-dropdownmenu-item-padding': itemPaddingMap[state.itemDensity] || itemPaddingMap.normal,
  };
}

export const DropdownMenuThemeSlice: ThemeSlice<DropdownMenuSliceState, DropdownMenuCSSVariables> = {
  id: 'dropdownmenu',
  name: '⚙️ Dropdown Menu Shadow & Density',
  category: 'Overlays',
  defaultState: defaultDropdownMenuState,
  getCSSVariables: getDropdownMenuVariables,
  fieldVars: {
    shadowDepth: ['--ai-dropdownmenu-shadow'],
    itemDensity: ['--ai-dropdownmenu-item-padding'],
  },
};
