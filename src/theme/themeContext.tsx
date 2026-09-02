import React, { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { type HSVColor } from './hsv';
import {
  type HarmonyMode,
  type ThemeParameters,
  type GeneratedPalette,
  generateHarmonyPalette,
  paletteToCSSVariables,
} from './harmonies';
import { type PaddingMode, PaddingThemeSlice } from './padding';
import { type MarginMode, MarginThemeSlice } from './margin';
import { type CornerRadiusMode, RadiusThemeSlice } from './radius';
import { type ShadowMode, ShadowThemeSlice } from './shadow';
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
import { DatePickerThemeSlice } from '../components/DatePicker/DatePickerSlice';
import { BreadcrumbThemeSlice } from '../components/Breadcrumb/BreadcrumbSlice';
import { CarouselThemeSlice } from '../components/Carousel/CarouselSlice';
import { ComboboxThemeSlice } from '../components/Form/ComboboxSlice';
import { CommandPaletteThemeSlice } from '../components/CommandPalette/CommandPaletteSlice';
import { FileUploadThemeSlice } from '../components/Form/FileUploadSlice';
import { GalleryThemeSlice } from '../components/Gallery/GallerySlice';
import { HoverCardThemeSlice } from '../components/HoverCard/HoverCardSlice';
import { LabelThemeSlice } from '../components/Form/LabelSlice';
import { ScrollAreaThemeSlice } from '../components/ScrollArea/ScrollAreaSlice';
import { ViewerThemeSlice } from '../components/Viewer/ViewerSlice';
import { ChartThemeSlice } from '../components/Chart/ChartSlice';
import { globalThemeSliceRegistry } from './slice';
import { type ToolcribSliceStateMap, type ToolcribSliceStates } from './sliceStateMap';
import { aiBus } from '../eventBus/eventBus';
import { injectGlobalStyle, upsertGlobalStyle, removeGlobalStyle } from './injectGlobalStyle';
import {
  type ResponsiveThemeInput,
  isResponsiveConfig,
  resolveBaseMode,
  getResponsiveVariableKeys,
  generateResponsiveCSS,
} from './responsive';
import { injectSharedAnimationKeyframes, TOOLCRIB_SHARED_KEYFRAMES_CSS } from './animationKeyframes';
import { TargetDocumentContext } from './targetDocumentContext';
import { NonceContext } from './nonceContext';

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
globalThemeSliceRegistry.register(DatePickerThemeSlice);
globalThemeSliceRegistry.register(BreadcrumbThemeSlice);
globalThemeSliceRegistry.register(CarouselThemeSlice);
globalThemeSliceRegistry.register(ComboboxThemeSlice);
globalThemeSliceRegistry.register(CommandPaletteThemeSlice);
globalThemeSliceRegistry.register(FileUploadThemeSlice);
globalThemeSliceRegistry.register(GalleryThemeSlice);
globalThemeSliceRegistry.register(HoverCardThemeSlice);
globalThemeSliceRegistry.register(LabelThemeSlice);
globalThemeSliceRegistry.register(ScrollAreaThemeSlice);
globalThemeSliceRegistry.register(ViewerThemeSlice);
globalThemeSliceRegistry.register(ChartThemeSlice);

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

/**
 * `computeServerThemeCSS`'s return shape — separate strings rather
 * than one blob, specifically so each can be rendered under the id (see
 * `TOOLCRIB_TYPOGRAPHY_BASE_STYLE_ID`/`TOOLCRIB_RESPONSIVE_STYLE_ID` below)
 * that makes `injectGlobalStyle`/`upsertGlobalStyle`'s client-side dedup
 * recognize it as already-present on hydration, instead of duplicating it.
 * @barrelExport
 */
export interface ServerThemeCSS {
  /**
   * A `:root { ... }` rule containing every computed CSS custom property
   * — the SSR equivalent of the client's inline `root.style.setProperty`
   * writes (the injection effect in `ThemeProvider` itself). No fixed id
   * needed: an inline style write is idempotent (setting the same property
   * to the same value twice has no effect), so this isn't subject to any
   * id-based dedup at all — render it under any `<style>` tag.
   */
  rootVariablesCSS: string;
  /** Render as `<style id={TOOLCRIB_RESPONSIVE_STYLE_ID}>`, or omit entirely when `null` (matches the client's `removeGlobalStyle` branch, which runs when nothing is under responsive control). */
  responsiveCSS: string | null;
  /** Render as `<style id={TOOLCRIB_TYPOGRAPHY_BASE_STYLE_ID}>`. */
  typographyCSS: string;
  /** Render as `<style id={TOOLCRIB_SHARED_KEYFRAMES_STYLE_ID}>` (that id is exported from `./animationKeyframes`, not this file). */
  keyframesCSS: string;
  /** Render as `<style id={TOOLCRIB_THEME_TRANSITIONS_STYLE_ID}>`. */
  transitionsCSS: string;
}

/**
 * Element ids `ThemeProvider` gives the two `<style>` tags it owns —
 * exported so `computeServerThemeCSS`'s SSR output can be rendered under
 * the exact same ids: `injectGlobalStyle`/`upsertGlobalStyle` dedup by
 * `getElementById(id)`, so a server-rendered `<style>` tag using these ids
 * verbatim is recognized as already-present on hydration (no duplicate
 * tag, and — for the responsive one — later live updates via
 * `upsertGlobalStyle` correctly update that same tag instead of a stale
 * copy). A consumer-chosen id would silently defeat this.
 * @barrelExport
 */
export const TOOLCRIB_TYPOGRAPHY_BASE_STYLE_ID = 'toolcrib-typography-base';
/** @barrelExport */
export const TOOLCRIB_RESPONSIVE_STYLE_ID = 'toolcrib-responsive-theme';

/**
 * The ambient typography/color base rule applied to `:root` — a static
 * string (references only `var(--ai-*, fallback)`, no per-instance
 * computation) exported so `computeServerThemeCSS` can return the exact
 * same text for SSR rendering rather than a second, hand-copied literal
 * that could drift.
 * @barrelExport
 */
export const TOOLCRIB_TYPOGRAPHY_BASE_CSS = `:root { font-family: var(--ai-font-family, Inter, system-ui, Avenir, Helvetica, Arial, sans-serif); font-size: var(--ai-master-font-size, 16px); line-height: var(--ai-line-height, 1.5); color: var(--ai-text-primary, #111827); }`;

/** @barrelExport */
export const TOOLCRIB_THEME_TRANSITIONS_STYLE_ID = 'toolcrib-theme-transitions';

/**
 * Makes a theme/dark-mode/subtheme switch fade smoothly instead of cutting
 * instantly — before this, no theme variable change animated anywhere
 * (confirmed: nothing in this file ever set a `transition`), so toggling
 * dark mode or a subtheme was a hard visual cut everywhere except the
 * handful of components that happened to wire in `--ai-transition-normal`
 * themselves for unrelated hover/press feedback.
 *
 * `:where(*)` (zero specificity) rather than a bare `*`: any component that
 * already manages its own `transition`/`transition-property` inline (e.g.
 * `Button`'s `all var(--ai-transition-normal)`) is completely unaffected —
 * inline `style` always wins the cascade over any external stylesheet rule
 * regardless of selector specificity, so this only ever supplies a baseline
 * for elements that don't already have one of their own.
 *
 * Longhand `transition-property`/`-duration`/`-timing-function`, not the
 * `transition` shorthand: a shorthand here would need its own full value on
 * one line, whereas the longhand form lets `--ai-theme-transition-properties`
 * be independently overridden (e.g. a consumer wanting `outline-color` added,
 * or `box-shadow` removed because it's already busy for a different purpose)
 * without having to restate the duration/easing too.
 *
 * Deliberately reuses `--ai-transition-duration-normal`/`--ai-transition-easing`
 * (`animation.tsx`) rather than inventing parallel variables — both are
 * already CSS-variable-driven, already user-configurable via the Theme
 * Editor's Motion/Physics preset, and already collapse to `0s`/`linear`
 * under `reducedMotion: 'always'` or `preset: 'none'`, so this gets that
 * same accessibility behavior for free instead of needing its own guard.
 *
 * Deliberately excludes layout-affecting properties (`transform`, `width`,
 * `height`, `top`/`left`, etc.) from the default list — this codebase has a
 * real history of subtle animation bugs from over-broad transitions (see
 * AGENTS.md's Toast/SlideOut/Splitter races and `tabstrip-jitter.spec.ts`),
 * so the default only ever covers purely visual/color-bearing properties,
 * never anything a layout/drag/resize mechanism elsewhere depends on.
 * @barrelExport
 */
export const TOOLCRIB_THEME_TRANSITIONS_CSS = `:where(*) {
  transition-property: var(--ai-theme-transition-properties, background-color, color, border-color, box-shadow, fill, stroke, outline-color, text-decoration-color);
  transition-duration: var(--ai-transition-duration-normal, 0.2s);
  transition-timing-function: var(--ai-transition-easing, ease);
}`;

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
  /**
   * A Content-Security-Policy nonce, set on every `<style>` tag this
   * provider creates (the typography base rule, responsive `@media`
   * blocks) so they aren't silently dropped under a strict, nonce-based
   * `style-src` (no `'unsafe-inline'`). Only needed for that specific
   * policy shape — everything else about toolcrib's styling (inline
   * `style` props, the overwhelming majority of it) goes through React's
   * own CSSOM-property-assignment path, which CSP's `style-src-attr`
   * enforcement doesn't intercept regardless of this prop. See CORE.md's
   * CSP note for the full picture. The value itself has to come from
   * your own server-rendered nonce (CSP nonces must be unique per
   * request) — this prop only threads it through, it doesn't generate one.
   */
  nonce?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialParameters,
  initialSliceStates,
  targetDocument,
  nonce,
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

  // A ResponsiveModeConfig's `base` tier resolved to a bare mode string --
  // this is what feeds every consumer downstream that only ever expected
  // a bare string (paletteToCSSVariables, computeAllVariables, and this
  // memo's own inline-style application). It's also the correct SSR/
  // first-paint value: `base` is unconditional, matching this codebase's
  // established pattern (useStableId/Splitter) of a static deterministic
  // default rather than anything measured.
  const resolvedPaddingMode = resolveBaseMode(parameters.paddingMode);
  const resolvedMarginMode = resolveBaseMode(parameters.marginMode || 'normal');
  const resolvedCornerRadiusMode = resolveBaseMode(parameters.cornerRadiusMode);

  // Which of the three families are under responsive control right now,
  // in the small flat shape generateResponsiveCSS/getResponsiveVariableKeys
  // (responsive.ts) expect -- recomputed whenever any of the three
  // parameters changes (a live Theme Editor setter can flip a mode
  // between static and responsive at any time, not just at mount).
  const responsiveInput = useMemo(() => {
    const input: ResponsiveThemeInput = {};
    if (isResponsiveConfig(parameters.paddingMode)) input.padding = parameters.paddingMode;
    if (isResponsiveConfig(parameters.marginMode)) input.margin = parameters.marginMode;
    if (isResponsiveConfig(parameters.cornerRadiusMode)) input.radius = parameters.cornerRadiusMode;
    return input;
  }, [parameters.paddingMode, parameters.marginMode, parameters.cornerRadiusMode]);

  // The CSS variable names owned by whichever families are responsive --
  // these must never also be set inline (see the injection effect below):
  // an inline style always beats a stylesheet rule, @media or not,
  // regardless of specificity, so a key left in both places would make
  // its @media rules permanently dead code.
  const responsiveVariableKeys = useMemo(() => getResponsiveVariableKeys(responsiveInput), [responsiveInput]);
  const prevResponsiveKeysRef = useRef<Set<string>>(new Set());

  const cssVariables = useMemo(() => {
    const baseVars = paletteToCSSVariables(
      palette,
      resolvedPaddingMode,
      resolvedCornerRadiusMode,
      resolvedMarginMode,
      parameters.isDarkMode
    );
    const sliceVars = globalThemeSliceRegistry.computeAllVariables({
      padding: resolvedPaddingMode,
      margin: resolvedMarginMode,
      radius: resolvedCornerRadiusMode,
      shadow: parameters.shadowMode,
      ...sliceStates,
    });
    return { ...baseVars, ...sliceVars };
  }, [palette, parameters, sliceStates, resolvedPaddingMode, resolvedMarginMode, resolvedCornerRadiusMode]);

  // Inject CSS variables into root document element
  useEffect(() => {
    const root = (targetDocument ?? document).documentElement;

    // A key that just became responsive-controlled (a live setter flipped
    // it from a bare mode to a ResponsiveModeConfig) may still carry a
    // stale inline value from before the flip -- an inline value that
    // predates going responsive still wins the cascade forever unless
    // explicitly cleared, since nothing else ever removes it on its own.
    for (const key of responsiveVariableKeys) {
      if (!prevResponsiveKeysRef.current.has(key)) root.style.removeProperty(key);
    }
    prevResponsiveKeysRef.current = responsiveVariableKeys;

    Object.entries(cssVariables).forEach(([key, value]) => {
      if (responsiveVariableKeys.has(key)) return; // owned by the responsive <style> block instead, see below
      root.style.setProperty(key, value);
    });

    // Notify Event Bus of theme change
    aiBus.emit('theme:changed', { parameters, palette, cssVariables });
  }, [cssVariables, parameters, palette, targetDocument, responsiveVariableKeys]);

  // The @media-guarded counterpart to the inline loop above -- generates
  // real CSS text (base :root {} + one @media block per configured
  // breakpoint) via responsive.ts and upserts it into a single <style>
  // tag. upsertGlobalStyle, not injectGlobalStyle: a live setter
  // (setPaddingMode etc.) can change this content at any point in the
  // provider's lifetime, unlike every other injectGlobalStyle caller's
  // genuinely static content.
  useEffect(() => {
    const doc = targetDocument ?? document;
    if (Object.keys(responsiveInput).length === 0) {
      removeGlobalStyle(TOOLCRIB_RESPONSIVE_STYLE_ID, doc);
      return;
    }
    upsertGlobalStyle(TOOLCRIB_RESPONSIVE_STYLE_ID, generateResponsiveCSS(responsiveInput), doc, nonce);
  }, [responsiveInput, targetDocument, nonce]);

  // `--ai-font-family`/`--ai-master-font-size`/`--ai-text-primary` above are
  // written as CSS custom properties on :root, but a custom property alone
  // does nothing — nothing actually *uses* `var(--ai-font-family)`/
  // `var(--ai-master-font-size)` as a real `font-family`/`font-size` unless
  // some rule references it. That rule used to live only in the demo app's
  // own index.css; a real consumer got the variables updating correctly
  // (visible via devtools) with zero visual effect anywhere, including on
  // this toolkit's own `rem`-based sizing throughout every component,
  // which can only ever scale via :root's actual resolved font-size
  // (that's inherent to what `rem` means — no scoped rule can substitute
  // for it). One rule, injected once per target document (typically once
  // total — the common case is a single ThemeProvider).
  //
  // `color` on :root is the same story for a different reason: unlike
  // font-family/font-size, `color` genuinely *is* an inherited CSS
  // property, so setting it here does make it ambient for every plain
  // element in a consumer's own app, not just toolcrib's own components
  // (which already resolve their own text color explicitly, same as
  // every other themed value). Without this, a consumer's own hand-written
  // `<div>` never picked up the theme's text color at all unless they
  // separately set it themselves — asymmetric with font-family, which
  // already worked this way, for no principled reason.
  //
  // `line-height` closes the same gap again: `--ai-line-height`
  // (typography.tsx's `baseLineHeight`, exposed in the Theme Editor as
  // "Line Height (Text Density)") is a real, inherited CSS property with
  // its own theme control, but before this only `Card.Content` ever read
  // `var(--ai-line-height)` explicitly — every other component's text, and
  // any plain consumer markup, silently ignored it, so moving that slider
  // had zero visible effect anywhere else despite reading as a global
  // control. Ambient injection here is what actually makes it one.
  useEffect(() => {
    injectGlobalStyle(TOOLCRIB_TYPOGRAPHY_BASE_STYLE_ID, TOOLCRIB_TYPOGRAPHY_BASE_CSS, targetDocument, nonce);
  }, [targetDocument, nonce]);

  // See TOOLCRIB_THEME_TRANSITIONS_CSS's own doc comment for why this is
  // safe to apply ambiently (zero-specificity selector, inline styles
  // always win) and why it only covers color-bearing properties.
  useEffect(() => {
    injectGlobalStyle(TOOLCRIB_THEME_TRANSITIONS_STYLE_ID, TOOLCRIB_THEME_TRANSITIONS_CSS, targetDocument, nonce);
  }, [targetDocument, nonce]);

  // The sole injection point for the shared entrance/exit @keyframes
  // (Modal/Drawer/Popup/AlertDialog/TabStrip.Panel/Accordion) — see
  // animationKeyframes.ts's own doc comment for why this used to also run
  // eagerly at module-load time, and why that was removed (it silently
  // defeated `nonce` for the default, un-portaled document by winning
  // injectGlobalStyle's create-once-per-id dedup before this effect could
  // ever run). This one call now correctly covers both the common case
  // (the default `document`) and a `targetDocument` pointing somewhere
  // else entirely (e.g. an <iframe>'s own document via
  // ReactDOM.createPortal).
  useEffect(() => {
    injectSharedAnimationKeyframes(targetDocument, nonce);
  }, [targetDocument, nonce]);

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
      <TargetDocumentContext.Provider value={targetDocument}>
        <NonceContext.Provider value={nonce}>{children}</NonceContext.Provider>
      </TargetDocumentContext.Provider>
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

/**
 * The SSR-safe counterpart to `<ThemeProvider>`'s own client-only CSS
 * injection — a pure, DOM-free function computing the exact same CSS
 * `ThemeProvider` would eventually apply, as plain text, for a consumer's
 * own SSR framework (Next.js, Remix, ...) to render synchronously in the
 * initial server-rendered HTML. Without this, a server-rendered page ships
 * default/unthemed markup that visibly flashes to the real theme once
 * `ThemeProvider`'s client-side effects run after hydration.
 *
 * Pass the exact same `initialParameters`/`initialSliceStates` you give
 * `<ThemeProvider>` — mirrors that component's own parameter-merging and
 * variable-computation logic line for line (reusing the same private
 * `defaultParameters`/`PARAMETER_DRIVEN_SLICE_IDS` constants and the same
 * pure helpers `ThemeProvider` itself calls), so the two can't drift out
 * of sync with each other. See `ai-docs/examples/ssr-theme-injection.md`
 * for the full rendering pattern, including why matching ids matter for
 * hydration and why `rootVariablesCSS` doesn't need one.
 * @barrelExport
 */
export function computeServerThemeCSS(
  initialParameters?: Partial<ThemeParameters & { shadowMode?: ShadowMode }>,
  initialSliceStates?: Partial<ToolcribSliceStateMap>
): ServerThemeCSS {
  const parameters = { ...defaultParameters, ...initialParameters };

  const sliceStates = {} as Record<string, unknown>;
  for (const slice of globalThemeSliceRegistry.getAll()) {
    if (PARAMETER_DRIVEN_SLICE_IDS.has(slice.id)) continue;
    const override = (initialSliceStates as Record<string, unknown> | undefined)?.[slice.id];
    sliceStates[slice.id] = { ...slice.defaultState, ...(override as object | undefined) };
  }

  const palette = generateHarmonyPalette(parameters);
  const resolvedPaddingMode = resolveBaseMode(parameters.paddingMode);
  // marginMode is optional on ThemeParameters (unlike paddingMode/cornerRadiusMode) —
  // must replicate the same `|| 'normal'` fallback the provider's own effect uses.
  const resolvedMarginMode = resolveBaseMode(parameters.marginMode || 'normal');
  const resolvedCornerRadiusMode = resolveBaseMode(parameters.cornerRadiusMode);

  const responsiveInput: ResponsiveThemeInput = {};
  if (isResponsiveConfig(parameters.paddingMode)) responsiveInput.padding = parameters.paddingMode;
  if (isResponsiveConfig(parameters.marginMode)) responsiveInput.margin = parameters.marginMode;
  if (isResponsiveConfig(parameters.cornerRadiusMode)) responsiveInput.radius = parameters.cornerRadiusMode;
  const responsiveVariableKeys = getResponsiveVariableKeys(responsiveInput);

  const baseVars = paletteToCSSVariables(
    palette,
    resolvedPaddingMode,
    resolvedCornerRadiusMode,
    resolvedMarginMode,
    parameters.isDarkMode
  );
  const sliceVars = globalThemeSliceRegistry.computeAllVariables({
    padding: resolvedPaddingMode,
    margin: resolvedMarginMode,
    radius: resolvedCornerRadiusMode,
    shadow: parameters.shadowMode,
    ...(sliceStates as ToolcribSliceStates),
  });
  const cssVariables = { ...baseVars, ...sliceVars };

  // Same exclusion as the provider's own injection effect: a variable
  // family under responsive control lives in the @media-guarded stylesheet
  // instead — an inline value always wins the cascade regardless of
  // specificity, so including it here too would permanently defeat its
  // own @media rules the moment the client's effects run.
  const rootDeclarations = Object.entries(cssVariables)
    .filter(([key]) => !responsiveVariableKeys.has(key))
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');

  return {
    rootVariablesCSS: `:root {\n${rootDeclarations}\n}`,
    responsiveCSS: Object.keys(responsiveInput).length === 0 ? null : generateResponsiveCSS(responsiveInput),
    typographyCSS: TOOLCRIB_TYPOGRAPHY_BASE_CSS,
    keyframesCSS: TOOLCRIB_SHARED_KEYFRAMES_CSS,
    transitionsCSS: TOOLCRIB_THEME_TRANSITIONS_CSS,
  };
}
