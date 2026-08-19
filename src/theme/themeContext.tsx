import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { HSVColor } from './hsv';
import {
  HarmonyMode,
  ThemeParameters,
  GeneratedPalette,
  generateHarmonyPalette,
  paletteToCSSVariables,
} from './harmonies';
import { PaddingMode, PaddingThemeSlice } from './padding';
import { MarginMode, MarginThemeSlice } from './margin';
import { CornerRadiusMode, RadiusThemeSlice } from './radius';
import { ShadowMode, ShadowThemeSlice } from './shadow';
import { DataTableThemeSlice } from '../components/DataTable/DataTableSlice';
import { AnimationThemeSlice } from './animation';
import { TabThemeSlice } from '../components/TabStrip/TabSlice';
import { DrawerThemeSlice } from '../components/Overlay/DrawerSlice';
import { AccordionThemeSlice } from '../components/Accordion/AccordionSlice';
import { CardThemeSlice } from '../components/Card/CardSlice';
import { TooltipThemeSlice } from '../components/Tooltip/TooltipSlice';
import { ButtonThemeSlice } from '../components/Form/ButtonSlice';
import { InputThemeSlice } from '../components/Form/InputSlice';
import { ToggleControlThemeSlice } from '../components/Form/ToggleControlSlice';
import { SelectThemeSlice } from '../components/Form/SelectSlice';
import { RadioGroupThemeSlice } from '../components/Form/RadioGroupSlice';
import { SliderThemeSlice } from '../components/Form/SliderSlice';
import { ModalThemeSlice } from '../components/Overlay/ModalSlice';
import { AlertDialogThemeSlice } from '../components/AlertDialog/AlertDialogSlice';
import { PopupThemeSlice } from '../components/Overlay/PopupSlice';
import { ToastThemeSlice } from '../components/Toast/ToastSlice';
import { DropdownMenuThemeSlice } from '../components/DropdownMenu/DropdownMenuSlice';
import { ContextMenuThemeSlice } from '../components/ContextMenu/ContextMenuSlice';
import { ProgressThemeSlice } from '../components/Progress/ProgressSlice';
import { SeparatorThemeSlice } from '../components/Separator/SeparatorSlice';
import { AvatarThemeSlice } from '../components/Avatar/AvatarSlice';
import { ToggleThemeSlice } from '../components/ToggleGroup/ToggleSlice';
import { CollapsibleThemeSlice } from '../components/Collapsible/CollapsibleSlice';
import { UIGroupThemeSlice } from '../components/UIGroup/UIGroupSlice';
import { ToolbarThemeSlice } from '../components/Toolbar/ToolbarSlice';
import { AppShellThemeSlice } from '../components/AppShell/AppShellSlice';
import { TypographyThemeSlice } from './typography';
import { TreeThemeSlice } from '../components/Tree/TreeSlice';
import { RatingThemeSlice } from '../components/Rating/RatingSlice';
import { SidebarThemeSlice } from '../components/Sidebar/SidebarSlice';
import { StepperThemeSlice } from '../components/Stepper/StepperSlice';
import { globalThemeSliceRegistry } from './slice';
import { ToolcribSliceStateMap, ToolcribSliceStates } from './sliceStateMap';
import { aiBus } from '../eventBus/eventBus';
import { injectGlobalStyle } from './injectGlobalStyle';
import { injectSharedAnimationKeyframes } from './animationKeyframes';
import { TargetDocumentContext } from './targetDocumentContext';

// Register standard theme slices
globalThemeSliceRegistry.register(PaddingThemeSlice);
globalThemeSliceRegistry.register(MarginThemeSlice);
globalThemeSliceRegistry.register(RadiusThemeSlice);
globalThemeSliceRegistry.register(ShadowThemeSlice);
globalThemeSliceRegistry.register(DataTableThemeSlice);
globalThemeSliceRegistry.register(AnimationThemeSlice);
globalThemeSliceRegistry.register(TabThemeSlice);
globalThemeSliceRegistry.register(DrawerThemeSlice);
globalThemeSliceRegistry.register(AccordionThemeSlice);
globalThemeSliceRegistry.register(CardThemeSlice);
globalThemeSliceRegistry.register(TooltipThemeSlice);
globalThemeSliceRegistry.register(ButtonThemeSlice);
globalThemeSliceRegistry.register(InputThemeSlice);
globalThemeSliceRegistry.register(ToggleControlThemeSlice);
globalThemeSliceRegistry.register(SelectThemeSlice);
globalThemeSliceRegistry.register(RadioGroupThemeSlice);
globalThemeSliceRegistry.register(SliderThemeSlice);
globalThemeSliceRegistry.register(ModalThemeSlice);
globalThemeSliceRegistry.register(AlertDialogThemeSlice);
globalThemeSliceRegistry.register(PopupThemeSlice);
globalThemeSliceRegistry.register(ToastThemeSlice);
globalThemeSliceRegistry.register(DropdownMenuThemeSlice);
globalThemeSliceRegistry.register(ContextMenuThemeSlice);
globalThemeSliceRegistry.register(ProgressThemeSlice);
globalThemeSliceRegistry.register(SeparatorThemeSlice);
globalThemeSliceRegistry.register(AvatarThemeSlice);
globalThemeSliceRegistry.register(ToggleThemeSlice);
globalThemeSliceRegistry.register(CollapsibleThemeSlice);
globalThemeSliceRegistry.register(UIGroupThemeSlice);
globalThemeSliceRegistry.register(ToolbarThemeSlice);
globalThemeSliceRegistry.register(AppShellThemeSlice);
globalThemeSliceRegistry.register(TypographyThemeSlice);
globalThemeSliceRegistry.register(TreeThemeSlice);
globalThemeSliceRegistry.register(RatingThemeSlice);
globalThemeSliceRegistry.register(SidebarThemeSlice);
globalThemeSliceRegistry.register(StepperThemeSlice);

/** @barrelExport */
export interface ThemeContextType {
  parameters: ThemeParameters & { shadowMode?: ShadowMode };
  /**
   * Every registered slice's live, complete state, keyed by the slice's own
   * `id` -- `sliceStates.drawer`, `sliceStates.accordion`, etc. Replaces
   * what used to be 28 separately-named fields (`tableState`, `drawerState`,
   * ...) on this interface, each with its own hand-written setter below.
   * Still fully typed per key via `ToolcribSliceStates` (`./sliceStateMap`,
   * itself derived from the same declaration-merged map `initialSliceStates`
   * uses) -- `theme.sliceStates.drawer.width` autocompletes and rejects a
   * wrong field name exactly as `theme.drawerState.width` used to.
   */
  sliceStates: ToolcribSliceStates;
  palette: GeneratedPalette;
  cssVariables: Record<string, string>;
  setBaseColor: (color: HSVColor) => void;
  setHarmonyMode: (mode: HarmonyMode) => void;
  setHueSpread: (spread: number) => void;
  setDarkenLightenFactor: (factor: number) => void;
  setSaturationFactor: (factor: number) => void;
  setPaddingMode: (mode: PaddingMode) => void;
  setMarginMode: (mode: MarginMode) => void;
  setCornerRadiusMode: (mode: CornerRadiusMode) => void;
  setShadowMode: (mode: ShadowMode) => void;
  /**
   * Replaces the 28 separately-named `set<X>State` setters. Generic over
   * `id`, but not over `any`: `K` is inferred from the literal `id` passed
   * in, so `setSliceState('drawer', { width: 'lg' })` only accepts fields
   * that actually exist on `DrawerSliceState`, and a typo in either the id
   * or a field name is a compile error, same safety the 28 individual
   * setters used to provide.
   */
  setSliceState: <K extends keyof ToolcribSliceStateMap>(id: K, patch: Partial<ToolcribSliceStates[K]>) => void;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
}

const defaultParameters: ThemeParameters & { shadowMode: ShadowMode } = {
  // Matches presetThemes.ts's 'tailwind' preset — Tailwind CSS's blue-500
  // (#3b82f6) converted to HSV, light mode. Not derived from that preset
  // programmatically (see presetThemes.ts's header comment: presets are
  // pure bundled data with no dependency on this file); kept in sync by
  // hand, same as every preset here always has been.
  baseColor: { h: 217, s: 76, v: 96 },
  harmonyMode: 'analogous',
  hueSpread: 30,
  darkenLightenFactor: 1.0,
  saturationFactor: 1.0,
  paddingMode: 'normal',
  marginMode: 'normal',
  cornerRadiusMode: 'rounded',
  shadowMode: 'subtle',
  isDarkMode: false,
};

// These four slices are driven by `parameters`/`initialParameters` instead
// of `sliceStates`/`initialSliceStates` -- a distinct, pre-existing
// category (global HSV/spacing/corner-radius parameters), not a
// per-component override slice. Excluded here, and from
// `ToolcribSliceStateMap` (see sliceStateMap.ts), for the same reason.
const PARAMETER_DRIVEN_SLICE_IDS = new Set(['padding', 'margin', 'radius', 'shadow']);

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export interface ThemeProviderProps {
  children: ReactNode;
  initialParameters?: Partial<ThemeParameters & { shadowMode?: ShadowMode }>;
  /**
   * Per-slice initial overrides, keyed by each slice's own `id` (`table`,
   * `drawer`, `accordion`, ...). Replaces what used to be 28 separate
   * `initial<X>State` props — one per registered slice, hand-maintained on
   * this interface, on `ThemeProvider`'s destructured params, and on eight
   * other repetition sites throughout this file and `themePersistence.ts`.
   * `ToolcribSliceStateMap` (`./sliceStateMap`) is built via TypeScript
   * declaration merging: each slice's own file contributes its own entry
   * (see `DrawerSlice.ts` for the pattern), so a new component's slice file
   * is the only place that needs touching to plug into this prop — nothing
   * shared ever needs editing again. Excludes `padding`/`margin`/`radius`/
   * `shadow`, which stay driven by `initialParameters` above — a distinct,
   * pre-existing category (global HSV/spacing/corner-radius parameters),
   * not a per-component override slice.
   */
  initialSliceStates?: Partial<ToolcribSliceStateMap>;
  /**
   * The `Document` whose `<html>` element gets this provider's CSS custom
   * properties. Defaults to the global `document` — correct for the
   * overwhelmingly common case of one `ThemeProvider` at the root of an
   * app. Pass a different `Document` explicitly (e.g. an `<iframe>`'s own
   * `contentDocument`) when portaling a second, independent
   * `ThemeProvider` instance into a different document's DOM — using the
   * default here would inject that instance's variables onto the
   * *outer* page's `<html>` instead of the iframe's own `:root`, silently
   * fighting with (and corrupting) whichever `ThemeProvider` owns the
   * outer page, since `document` always resolves to it regardless of
   * where the component instance actually renders.
   */
  targetDocument?: Document;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialParameters,
  initialSliceStates,
  targetDocument,
}) => {
  const [parameters, setParameters] = useState<ThemeParameters & { shadowMode?: ShadowMode }>({
    ...defaultParameters,
    ...initialParameters,
  });

  // One state object for every registered slice except the four
  // parameter-driven ones, seeded by looping the registry and merging each
  // slice's own `defaultState` with `initialSliceStates`'s matching entry
  // (if any) -- replaces what used to be 28 separate useState calls, each
  // hand-importing its own `default<X>State` constant. The lazy initializer
  // form (a function, not a plain object) means this loop only ever runs
  // once, on mount, same cost as the 28 individual useState calls it
  // replaces.
  const [sliceStates, setSliceStatesInternal] = useState<ToolcribSliceStates>(() => {
    const initial = {} as Record<string, unknown>;
    for (const slice of globalThemeSliceRegistry.getAll()) {
      if (PARAMETER_DRIVEN_SLICE_IDS.has(slice.id)) continue;
      const override = (initialSliceStates as Record<string, unknown> | undefined)?.[slice.id];
      initial[slice.id] = { ...slice.defaultState, ...(override as object | undefined) };
    }
    return initial as ToolcribSliceStates;
  });

  const palette = useMemo(() => {
    return generateHarmonyPalette(parameters);
  }, [parameters]);

  const cssVariables = useMemo(() => {
    const baseVars = paletteToCSSVariables(
      palette,
      parameters.paddingMode,
      parameters.cornerRadiusMode,
      parameters.marginMode || 'normal'
    );
    const sliceVars = globalThemeSliceRegistry.computeAllVariables({
      padding: parameters.paddingMode,
      margin: parameters.marginMode,
      radius: parameters.cornerRadiusMode,
      shadow: parameters.shadowMode,
      ...sliceStates,
    });
    return { ...baseVars, ...sliceVars };
  }, [palette, parameters, sliceStates]);

  // Inject CSS variables into root document element
  useEffect(() => {
    const root = (targetDocument ?? document).documentElement;
    Object.entries(cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Notify Event Bus of theme change
    aiBus.emit('theme:changed', { parameters, palette, cssVariables });
  }, [cssVariables, parameters, palette, targetDocument]);

  // `--ai-font-family`/`--ai-master-font-size` above are written as CSS
  // custom properties on :root, but a custom property alone does nothing
  // — nothing actually *uses* `var(--ai-font-family)`/
  // `var(--ai-master-font-size)` as a real `font-family`/`font-size`
  // unless some rule references it. That rule used to live only in the
  // demo app's own index.css; a real consumer got the variables updating
  // correctly (visible via devtools) with zero visual effect anywhere,
  // including on this toolkit's own `rem`-based sizing throughout every
  // component, which can only ever scale via :root's actual resolved
  // font-size (that's inherent to what `rem` means — no scoped rule can
  // substitute for it). One rule, injected once per target document
  // (typically once total — the common case is a single ThemeProvider).
  useEffect(() => {
    injectGlobalStyle(
      'toolcrib-typography-base',
      `:root { font-family: var(--ai-font-family, Inter, system-ui, Avenir, Helvetica, Arial, sans-serif); font-size: var(--ai-master-font-size, 16px); }`,
      targetDocument
    );
  }, [targetDocument]);

  // injectSharedAnimationKeyframes() (animationKeyframes.ts) already runs
  // eagerly, once, the moment the package is first imported — but that
  // call happens before any component (including this one) has rendered,
  // so it has no way to know about a `targetDocument` and only ever
  // reaches the global `document`. That's the right default (Modal/
  // Drawer/etc.'s entrance animations work with zero ThemeProvider
  // involvement), but it means the one case this component *does* know
  // about — a `targetDocument` pointing somewhere else entirely, e.g. an
  // <iframe>'s own document via ReactDOM.createPortal — would otherwise
  // never get its own copy of these keyframes, silently. Calling it again
  // here is a harmless no-op for the common case (idempotent, guarded by
  // injectGlobalStyle's per-document getElementById check) and the actual
  // fix for the portaled one.
  useEffect(() => {
    injectSharedAnimationKeyframes(targetDocument);
  }, [targetDocument]);

  const setBaseColor = (baseColor: HSVColor) => setParameters(p => ({ ...p, baseColor }));
  const setHarmonyMode = (harmonyMode: HarmonyMode) => setParameters(p => ({ ...p, harmonyMode }));
  const setHueSpread = (hueSpread: number) => setParameters(p => ({ ...p, hueSpread }));
  const setDarkenLightenFactor = (darkenLightenFactor: number) => setParameters(p => ({ ...p, darkenLightenFactor }));
  const setSaturationFactor = (saturationFactor: number) => setParameters(p => ({ ...p, saturationFactor }));
  const setPaddingMode = (paddingMode: PaddingMode) => setParameters(p => ({ ...p, paddingMode }));
  const setMarginMode = (marginMode: MarginMode) => setParameters(p => ({ ...p, marginMode }));
  const setCornerRadiusMode = (cornerRadiusMode: CornerRadiusMode) => setParameters(p => ({ ...p, cornerRadiusMode }));
  const setShadowMode = (shadowMode: ShadowMode) => setParameters(p => ({ ...p, shadowMode }));

  // Immutable by construction -- both the outer object and the touched
  // slice's own value are replaced, never mutated in place. This matters
  // more here than it did with 28 separate useState calls: cssVariables'
  // useMemo above now depends on this single `sliceStates` object by
  // reference, so an in-place mutation would silently stop triggering a
  // recompute instead of just one field lagging.
  const setSliceState = <K extends keyof ToolcribSliceStateMap>(id: K, patch: Partial<ToolcribSliceStates[K]>) => {
    setSliceStatesInternal(prev => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const toggleDarkMode = () => setParameters(p => ({ ...p, isDarkMode: !p.isDarkMode }));
  const setDarkMode = (isDarkMode: boolean) => setParameters(p => ({ ...p, isDarkMode }));

  const value: ThemeContextType = {
    parameters,
    sliceStates,
    palette,
    cssVariables,
    setBaseColor,
    setHarmonyMode,
    setHueSpread,
    setDarkenLightenFactor,
    setSaturationFactor,
    setPaddingMode,
    setMarginMode,
    setCornerRadiusMode,
    setShadowMode,
    setSliceState,
    toggleDarkMode,
    setDarkMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      <TargetDocumentContext.Provider value={targetDocument}>{children}</TargetDocumentContext.Provider>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
