import {
  type ThemeParameters,
  generateHarmonyPalette,
  paletteToCSSVariables,
} from './harmonies';
import { type ShadowMode } from './shadow';
import { globalThemeSliceRegistry } from './slice';
import { type ToolcribSliceStateMap, type ToolcribSliceStates } from './sliceStateMap';
import {
  type ResponsiveThemeInput,
  isResponsiveConfig,
  resolveBaseMode,
  getResponsiveVariableKeys,
  generateResponsiveCSS,
} from './responsive';
import { TOOLCRIB_SHARED_KEYFRAMES_CSS } from './animationKeyframes';
import { TOOLCRIB_LIVING_COLOR_CSS } from './livingColorStyles';
// Side-effect only -- populates globalThemeSliceRegistry. themeContext.tsx
// (a 'use client' file) imports the same module for the same reason; see
// registerThemeSlices.ts's own header comment for why this is split out.
import './registerThemeSlices';

/**
 * `computeServerThemeCSS`'s return shape — separate strings rather
 * than one blob, specifically so each can be rendered under the id (see
 * `TOOLCRIB_TYPOGRAPHY_BASE_STYLE_ID`/`TOOLCRIB_RESPONSIVE_STYLE_ID`, both
 * exported from `./themeContext`) that makes `injectGlobalStyle`/
 * `upsertGlobalStyle`'s client-side dedup recognize it as already-present
 * on hydration, instead of duplicating it.
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
  /** Render as `<style id={TOOLCRIB_LINK_STYLE_ID}>`. */
  linkCSS: string;
  /** Render as `<style id={TOOLCRIB_SHARED_KEYFRAMES_STYLE_ID}>` (that id is exported from `./animationKeyframes`, not this file). */
  keyframesCSS: string;
  /** Render as `<style id={TOOLCRIB_THEME_TRANSITIONS_STYLE_ID}>`. */
  transitionsCSS: string;
  /** Render as `<style id={TOOLCRIB_LIVING_COLOR_STYLE_ID}>` (that id is exported from `./livingColorStyles`, not this file). */
  livingColorCSS: string;
}

/**
 * The ambient typography/color base rule applied to `:root` — a static
 * string (references only `var(--ai-*, fallback)`, no per-instance
 * computation) exported so `computeServerThemeCSS` can return the exact
 * same text for SSR rendering rather than a second, hand-copied literal
 * that could drift. Also consumed by `ThemeProvider`'s own injection
 * effect in `./themeContext`, which imports it back from here.
 * @barrelExport
 */
export const TOOLCRIB_TYPOGRAPHY_BASE_CSS = `:root { font-family: var(--ai-font-family, Inter, system-ui, Avenir, Helvetica, Arial, sans-serif); font-size: var(--ai-master-font-size, 16px); line-height: var(--ai-line-height, 1.5); color: var(--ai-text-primary, #111827); }`;

/**
 * Ambient link/`:visited` colouring for every `<a>` in a consumer's app —
 * not just toolcrib's own `<Link>` component. Before this, a plain
 * hand-authored `<a>` got zero theming (no rule anywhere set `a { color }`),
 * so it either inherited whatever `:root`'s own text color was (no visited
 * distinction, no "this is a link" affordance at all) or the browser's
 * hardcoded UA-stylesheet blue/purple, neither of which tracks the theme.
 *
 * Uses `--ai-color-primary-readable`/`--ai-color-secondary-readable`
 * (harmonies.ts) rather than the raw `--ai-color-primary`/`-secondary` —
 * those are already WCAG-AA-checked against the page background via
 * `ensureWCAGContrast` (hsv.ts), which only ever nudges Value/Saturation,
 * *never* Hue — so a link stays recognizably "the theme's own primary hue"
 * (blue, by default) rather than being neutralized toward grey or shifted
 * to a different color for contrast's sake. Same mechanism `resolveColorVariant`
 * already uses for Badge/Toast's own "identity color as safe text on a
 * neutral surface" case (colorVariant.ts) — reused here, not reinvented.
 *
 * `--ai-link-color`/`--ai-link-visited-color` are the per-instance escape
 * hatch `<Link>` itself sets *inline* (never the `color` property directly)
 * to override just this rule's resolved value — `:visited` can only ever be
 * styled from a real stylesheet rule (never inline `style`, never read back
 * via script, by long-standing browser privacy restriction on visited-link
 * history sniffing), so a per-instance override has to flow through a CSS
 * custom property referenced here, not a `style.color` write that would
 * permanently defeat the `:visited` rule below it once visited.
 *
 * `.ai-link` alongside the bare `a` selector: `<Link>` renders `className="ai-link"`
 * so this same rule (and its per-instance variable overrides) applies to it
 * too, without a second, duplicate rule. Also consumed by `ThemeProvider`'s
 * own injection effect in `./themeContext`, which imports it back from here.
 * @barrelExport
 */
export const TOOLCRIB_LINK_CSS = `a, .ai-link { color: var(--ai-link-color, var(--ai-color-primary-readable, #1e3a8a)); }
a:visited, .ai-link:visited { color: var(--ai-link-visited-color, var(--ai-color-secondary-readable, #334155)); }`;

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
 * never anything a layout/drag/resize mechanism elsewhere depends on. Also
 * consumed by `ThemeProvider`'s own injection effect in `./themeContext`,
 * which imports it back from here.
 * @barrelExport
 */
export const TOOLCRIB_THEME_TRANSITIONS_CSS = `:where(*) {
  transition-property: var(--ai-theme-transition-properties, background-color, color, border-color, box-shadow, fill, stroke, outline-color, text-decoration-color);
  transition-duration: var(--ai-transition-duration-normal, 0.2s);
  transition-timing-function: var(--ai-transition-easing, ease);
}`;

// Shared with ThemeProvider (./themeContext, imports these back from here)
// so the client component and this SSR function can never drift out of
// sync with each other -- see computeServerThemeCSS's own doc comment.
export const defaultParameters: ThemeParameters & { shadowMode: ShadowMode } = {
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
export const PARAMETER_DRIVEN_SLICE_IDS = new Set(['padding', 'margin', 'radius', 'shadow']);

/**
 * The SSR-safe counterpart to `<ThemeProvider>`'s own client-only CSS
 * injection — a pure, DOM-free function computing the exact same CSS
 * `ThemeProvider` would eventually apply, as plain text, for a consumer's
 * own SSR framework (Next.js, Remix, ...) to render synchronously in the
 * initial server-rendered HTML. Without this, a server-rendered page ships
 * default/unthemed markup that visibly flashes to the real theme once
 * `ThemeProvider`'s client-side effects run after hydration.
 *
 * Deliberately kept in its own module without a `'use client'` directive
 * (unlike `./themeContext`, where `ThemeProvider` lives): a file-level
 * `'use client'` directive marks *every* export as a client reference to
 * Next.js's RSC analysis, including a plain function like this one, which
 * makes it impossible to call from a Server Component at all ("attempted
 * to call a client function from the server") — confirmed for real
 * building `cli/integration-test/run-nextjs-fixture.mjs`. This module (and
 * its own `./registerThemeSlices` side-effect import) has to stay reachable
 * without ever importing `./themeContext`.
 *
 * Pass the exact same `initialParameters`/`initialSliceStates` you give
 * `<ThemeProvider>` — mirrors that component's own parameter-merging and
 * variable-computation logic line for line (reusing the same
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
    linkCSS: TOOLCRIB_LINK_CSS,
    keyframesCSS: TOOLCRIB_SHARED_KEYFRAMES_CSS,
    transitionsCSS: TOOLCRIB_THEME_TRANSITIONS_CSS,
    livingColorCSS: TOOLCRIB_LIVING_COLOR_CSS,
  };
}
