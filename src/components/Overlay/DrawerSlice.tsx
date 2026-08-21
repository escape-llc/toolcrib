import { type ThemeSlice } from '../../theme/slice';
import { FieldRow } from '../ThemeEditor/ThemeEditorFieldRow';

declare module '../../theme/sliceStateMap' {
  interface ToolcribSliceStateMap {
    drawer: Partial<DrawerSliceState>;
  }
}

/** @barrelExport */
export type DrawerWidth = 'sm' | 'md' | 'lg' | '25vw' | '33vw' | '50vw' | '75vw' | 'full';
export type DrawerPosition = 'right' | 'left' | 'top' | 'bottom';
export type DrawerBackdrop = 'none' | 'subtle' | 'heavy';
export type DrawerHeaderMargin = 'none' | 'compact' | 'normal' | 'spacious' | 'detached';

export interface DrawerSliceState {
  width: DrawerWidth;
  position: DrawerPosition;
  backdropBlur: DrawerBackdrop;
  headerMargin: DrawerHeaderMargin;
}

export interface DrawerCSSVariables extends Record<string, string> {
  '--ai-drawer-width': string;
  '--ai-drawer-duration': string;
  '--ai-drawer-easing': string;
  '--ai-drawer-backdrop-blur': string;
  '--ai-drawer-header-margin': string;
  '--ai-drawer-header-border-radius': string;
}

export const defaultDrawerState: DrawerSliceState = {
  width: 'md',
  position: 'right',
  backdropBlur: 'subtle',
  headerMargin: 'none',
};

const widthMap: Record<DrawerWidth, string> = {
  sm: '20rem',
  md: '26rem',
  lg: '36rem',
  '25vw': '25vw',
  '33vw': '33.333vw',
  '50vw': '50vw',
  '75vw': '75vw',
  full: '100vw',
};

const blurMap: Record<DrawerBackdrop, string> = {
  none: '0rem',
  subtle: '0.125rem',
  heavy: '0.5rem',
};

const headerMarginMap: Record<DrawerHeaderMargin, string> = {
  none: '0',
  compact: '0 0 0.5rem 0',
  normal: '0 0 1rem 0',
  spacious: '0 0 1.5rem 0',
  detached: '0.75rem 0.75rem 0.5rem 0.75rem',
};

export function getDrawerVariables(state: DrawerSliceState = defaultDrawerState): DrawerCSSVariables {
  const { width, backdropBlur, headerMargin } = state;

  return {
    '--ai-drawer-width': widthMap[width] || widthMap.md,
    '--ai-drawer-duration': 'var(--ai-transition-duration-normal, 250ms)',
    '--ai-drawer-easing': 'var(--ai-transition-easing, cubic-bezier(0.4, 0, 0.2, 1))',
    '--ai-drawer-backdrop-blur': blurMap[backdropBlur] || blurMap.subtle,
    '--ai-drawer-header-margin': headerMarginMap[headerMargin] || headerMarginMap.none,
    '--ai-drawer-header-border-radius': headerMargin === 'detached' ? 'var(--ai-radius-md, 0.375rem)' : '0',
  };
}

export const DrawerThemeSlice: ThemeSlice<DrawerSliceState, DrawerCSSVariables> = {
  id: 'drawer',
  name: '🪟 Drawer & Retract Dynamics',
  category: 'Overlays',
  defaultState: defaultDrawerState,
  getCSSVariables: getDrawerVariables,
  renderEditorControl: (state, onChange) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <FieldRow
        label="Drawer Panel Width"
        tooltip="Configures default width for Drawer panels"
        value={state.width}
        onChange={val => onChange({ ...state, width: val as DrawerWidth })}
        options={[
          { label: 'Small (20rem / 320px)', value: 'sm' },
          { label: 'Medium (26rem / 416px)', value: 'md' },
          { label: 'Large (36rem / 576px)', value: 'lg' },
          { label: 'Quarter Screen (25vw)', value: '25vw' },
          { label: 'Third Screen (33vw)', value: '33vw' },
          { label: 'Half Screen (50vw)', value: '50vw' },
          { label: 'Three-Quarters (75vw)', value: '75vw' },
          { label: 'Full Screen (100vw)', value: 'full' },
        ]}
      />
      <FieldRow
        label="Drawer Header Margin & Floating Mode"
        value={state.headerMargin}
        onChange={val => onChange({ ...state, headerMargin: val as DrawerHeaderMargin })}
        options={[
          { label: 'Flush Header (0 Margin)', value: 'none' },
          { label: 'Compact Gap (0.5rem Bottom Margin)', value: 'compact' },
          { label: 'Normal Gap (1.0rem Bottom Margin)', value: 'normal' },
          { label: 'Spacious Gap (1.5rem Bottom Margin)', value: 'spacious' },
          { label: 'Floating Card Header (Detached Margin)', value: 'detached' },
        ]}
      />
      <FieldRow
        label="Backdrop Glassmorphism Blur"
        value={state.backdropBlur}
        onChange={val => onChange({ ...state, backdropBlur: val as DrawerBackdrop })}
        options={[
          { label: 'Subtle Blur (2px)', value: 'subtle' },
          { label: 'Heavy Glass Blur (8px)', value: 'heavy' },
          { label: 'None (Solid Backdrop)', value: 'none' },
        ]}
      />
    </div>
  ),
};
