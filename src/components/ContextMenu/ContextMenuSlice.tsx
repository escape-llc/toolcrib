import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    contextmenu: Partial<ContextMenuSliceState>;
  }
}

/** Same shape as DropdownMenuSlice — ContextMenu shares DropdownMenu's visual structure entirely (see ContextMenu.tsx's own comment on reusing MenuItemData), kept as its own slice per the one-slice-per-component convention. */
/** @barrelExport */
export type ContextMenuShadowDepth = 'subtle' | 'elevated';
export type ContextMenuItemDensity = 'compact' | 'normal';

export interface ContextMenuSliceState {
  shadowDepth: ContextMenuShadowDepth;
  itemDensity: ContextMenuItemDensity;
}

export interface ContextMenuCSSVariables extends Record<string, string> {
  '--ai-contextmenu-shadow': string;
  '--ai-contextmenu-item-padding': string;
}

export const defaultContextMenuState: ContextMenuSliceState = {
  shadowDepth: 'subtle',
  itemDensity: 'normal',
};

const shadowMap: Record<ContextMenuShadowDepth, string> = {
  subtle: '0 0.625rem 1.5625rem -0.3125rem rgba(0,0,0,0.15)',
  elevated: '0 1.25rem 2.5rem -0.5rem rgba(0,0,0,0.28)',
};

const itemPaddingMap: Record<ContextMenuItemDensity, string> = {
  compact: '0.3125rem 0.625rem',
  normal: '0.4375rem 0.75rem',
};

export function getContextMenuVariables(state: ContextMenuSliceState = defaultContextMenuState): ContextMenuCSSVariables {
  return {
    '--ai-contextmenu-shadow': shadowMap[state.shadowDepth] || shadowMap.subtle,
    '--ai-contextmenu-item-padding': itemPaddingMap[state.itemDensity] || itemPaddingMap.normal,
  };
}

export const ContextMenuThemeSlice: ThemeSlice<ContextMenuSliceState, ContextMenuCSSVariables> = {
  id: 'contextmenu',
  name: '🖱️ Context Menu Shadow & Density',
  category: 'Overlays',
  defaultState: defaultContextMenuState,
  getCSSVariables: getContextMenuVariables,
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Context Menu Shadow Depth"
        value={state.shadowDepth}
        onChange={val => onChange({ ...state, shadowDepth: val as ContextMenuShadowDepth })}
        options={[
          { label: 'Subtle', value: 'subtle' },
          { label: 'Elevated', value: 'elevated' },
        ]}
      />
      <FieldRow
        label="Context Menu Item Density"
        value={state.itemDensity}
        onChange={val => onChange({ ...state, itemDensity: val as ContextMenuItemDensity })}
        options={[
          { label: 'Compact', value: 'compact' },
          { label: 'Normal', value: 'normal' },
        ]}
      />
    </div>
  ),
  fieldVars: {
    shadowDepth: ['--ai-contextmenu-shadow'],
    itemDensity: ['--ai-contextmenu-item-padding'],
  },
};
