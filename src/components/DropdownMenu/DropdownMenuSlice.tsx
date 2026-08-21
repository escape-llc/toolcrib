import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    dropdownmenu: Partial<DropdownMenuSliceState>;
  }
}

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
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Dropdown Menu Shadow Depth"
        value={state.shadowDepth}
        onChange={val => onChange({ ...state, shadowDepth: val as DropdownMenuShadowDepth })}
        options={[
          { label: 'Subtle', value: 'subtle' },
          { label: 'Elevated', value: 'elevated' },
        ]}
      />
      <FieldRow
        label="Dropdown Menu Item Density"
        value={state.itemDensity}
        onChange={val => onChange({ ...state, itemDensity: val as DropdownMenuItemDensity })}
        options={[
          { label: 'Compact', value: 'compact' },
          { label: 'Normal', value: 'normal' },
        ]}
      />
    </div>
  ),
  fieldVars: {
    shadowDepth: ['--ai-dropdownmenu-shadow'],
    itemDensity: ['--ai-dropdownmenu-item-padding'],
  },
};
