'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { type HSVColor } from './hsv';
import {
  type HarmonyMode,
  type ThemeParameters,
  type GeneratedPalette,
  generateHarmonyPalette,
  paletteToCSSVariables,
} from './harmonies';
import { type PaddingMode } from './padding';
import { type MarginMode } from './margin';
import { type CornerRadiusMode } from './radius';
import { type ShadowMode } from './shadow';
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
import { injectSharedAnimationKeyframes } from './animationKeyframes';
import { injectLivingColorStyles } from './livingColorStyles';
import { TargetDocumentContext } from './targetDocumentContext';
import { NonceContext } from './nonceContext';
// defaultParameters/PARAMETER_DRIVEN_SLICE_IDS/the three TOOLCRIB_*_CSS
// constants below are shared with computeServerThemeCSS (./serverThemeCSS)
// so the two can never drift out of sync -- see that module's own header
// comment for why computeServerThemeCSS had to move out of this ('use
// client') file instead of just living here alongside ThemeProvider. The
// side-effect import of ./registerThemeSlices (which ./serverThemeCSS also
// imports independently) replaces this file's own former
// `globalThemeSliceRegistry.register(...)` calls.
import {
  defaultParameters,
  PARAMETER_DRIVEN_SLICE_IDS,
  TOOLCRIB_TYPOGRAPHY_BASE_CSS,
  TOOLCRIB_LINK_CSS,
  TOOLCRIB_THEME_TRANSITIONS_CSS,
} from './serverThemeCSS';
import './registerThemeSlices';

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

/** @barrelExport */
export const TOOLCRIB_LINK_STYLE_ID = 'toolcrib-link-base';

/** @barrelExport */
export const TOOLCRIB_THEME_TRANSITIONS_STYLE_ID = 'toolcrib-theme-transitions';

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

  // See TOOLCRIB_LINK_CSS's own doc comment for why this is ambient (every
  // plain `<a>`, not just `<Link>`) and why per-instance overrides go
  // through a CSS custom property rather than an inline `color`.
  useEffect(() => {
    injectGlobalStyle(TOOLCRIB_LINK_STYLE_ID, TOOLCRIB_LINK_CSS, targetDocument, nonce);
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

  // Opt-in-only decorative loop (.ai-living-accent/.ai-living-glow) — see
  // livingColorStyles.ts's own doc comment for why this isn't ambiently
  // applied to every element the way TOOLCRIB_THEME_TRANSITIONS_CSS is.
  useEffect(() => {
    injectLivingColorStyles(targetDocument, nonce);
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

// computeServerThemeCSS moved to ./serverThemeCSS -- see that module's
// header comment for why it can't live in this ('use client') file.
