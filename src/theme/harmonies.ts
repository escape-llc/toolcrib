import {
  HSVColor,
  normalizeHSV,
  shiftHue,
  adjustSaturation,
  applyDarkenLighten,
  hsvToCSS,
  ensureWCAGContrast,
  pickReadableTextColor,
} from './hsv';

import { PaddingMode, getPaddingVariables } from './padding';
import { MarginMode, getMarginVariables } from './margin';
import { CornerRadiusMode, getRadiusVariables } from './radius';

/** @barrelExport */
export type HarmonyMode =
  | 'monochromatic'
  | 'analogous'
  | 'split-complementary'
  | 'triadic'
  | 'tetradic';

export interface ThemeParameters {
  baseColor: HSVColor;
  harmonyMode: HarmonyMode;
  hueSpread: number; // e.g. 30
  darkenLightenFactor: number; // e.g. 1.0 (default), >1 lighter, <1 darker
  saturationFactor: number; // e.g. 1.0 (default)
  paddingMode: PaddingMode; // 'compact' | 'normal' | 'spacious'
  marginMode?: MarginMode; // 'compact' | 'normal' | 'spacious'
  cornerRadiusMode: CornerRadiusMode; // 'sharp' | 'subtle' | 'rounded' | 'pill'
  isDarkMode: boolean;
}

export interface SubThemeColorGroup {
  main: HSVColor;
  bg: HSVColor;
  border: HSVColor;
  text: HSVColor;
  /** Readable text/icon color for content painted directly on top of `main` as a solid fill (e.g. a filled badge) — see `pickReadableTextColor`. Distinct from `text`, which is for themed text on a neutral surface. */
  onMain: HSVColor;
}

export interface GeneratedPalette {
  base: HSVColor;
  primary: HSVColor;
  secondary: HSVColor;
  accent: HSVColor;
  /**
   * A 4th hue-based color role, present for every harmony mode (not just
   * `'tetradic'`) — each mode's own comment in generateHarmonyPalette
   * explains its specific 4th point.
   */
  quaternary: HSVColor;
  /** Readable text/icon color for content painted directly on top of `primary` as a solid fill — see `pickReadableTextColor`. */
  primaryText: HSVColor;
  /** Readable text/icon color for content painted directly on top of `secondary` as a solid fill. */
  secondaryText: HSVColor;
  /** Readable text/icon color for content painted directly on top of `accent` as a solid fill. */
  accentText: HSVColor;
  /** Readable text/icon color for content painted directly on top of `quaternary` as a solid fill. */
  quaternaryText: HSVColor;
  bgPrimary: HSVColor;
  bgSurface: HSVColor;
  bgContainer: HSVColor;
  textPrimary: HSVColor;
  textSecondary: HSVColor;
  border: HSVColor;
  focusRing: HSVColor;
  subThemes: {
    error: SubThemeColorGroup;
    success: SubThemeColorGroup;
    warning: SubThemeColorGroup;
    info: SubThemeColorGroup;
  };
}

/**
 * Generates a Monochromatic subtheme scheme anchored on a specific semantic hue,
 * carrying the SV (Saturation & Value) axes from the base theme and enforcing WCAG contrast ratios.
 */
function generateMonochromaticSubTheme(
  anchorHue: number,
  base: HSVColor,
  bgSurface: HSVColor,
  isDarkMode: boolean
): SubThemeColorGroup {
  // Inherit Saturation (S) and Value (V) from base color
  const carriedS = Math.max(50, Math.min(95, base.s));
  const carriedV = isDarkMode ? Math.max(75, base.v) : Math.max(45, Math.min(75, base.v));

  // Monochromatic main shade
  const rawMain: HSVColor = normalizeHSV({ h: anchorHue, s: carriedS, v: carriedV });
  const main = ensureWCAGContrast(rawMain, bgSurface, 3.0, isDarkMode);
  // Readable text/icon color for content filled directly on top of `main`
  // (e.g. a solid badge) — not run through ensureWCAGContrast, since that
  // preserves anchorHue while nudging V/S, which is the wrong tool for
  // "pick black or white for a fill that's already fixed."
  const onMain = pickReadableTextColor(main);

  // Monochromatic high-contrast text shade (WCAG AA 4.5:1 / AAA 7.0:1 compliant)
  const rawText: HSVColor = isDarkMode
    ? normalizeHSV({ h: anchorHue, s: Math.max(10, carriedS * 0.3), v: 95 })
    : normalizeHSV({ h: anchorHue, s: Math.min(100, carriedS * 1.25), v: 25 });
  const text = ensureWCAGContrast(rawText, bgSurface, 4.5, isDarkMode);

  // Background tint container shade
  const bg: HSVColor = isDarkMode
    ? normalizeHSV({ h: anchorHue, s: Math.min(40, carriedS * 0.4), v: 18 })
    : normalizeHSV({ h: anchorHue, s: Math.min(25, carriedS * 0.25), v: 96 });

  // Border shade
  const border: HSVColor = isDarkMode
    ? normalizeHSV({ h: anchorHue, s: Math.min(50, carriedS * 0.5), v: 35 })
    : normalizeHSV({ h: anchorHue, s: Math.min(45, carriedS * 0.4), v: 85 });

  return { main, bg, border, text, onMain };
}

/**
 * Calculates the color harmony palette from HSV base color and parameters.
 */
export function generateHarmonyPalette(params: ThemeParameters): GeneratedPalette {
  const {
    baseColor,
    harmonyMode,
    hueSpread,
    darkenLightenFactor,
    saturationFactor,
    isDarkMode,
  } = params;

  // Apply saturation and value adjustments to the base color
  let base = adjustSaturation(baseColor, saturationFactor);
  base = applyDarkenLighten(base, darkenLightenFactor);

  let primary: HSVColor;
  let secondary: HSVColor;
  let accent: HSVColor;
  let quaternary: HSVColor;

  switch (harmonyMode) {
    case 'monochromatic':
      primary = base;
      secondary = normalizeHSV({ ...base, v: Math.max(10, base.v * 0.7) });
      accent = normalizeHSV({ ...base, s: Math.min(100, base.s * 1.4), v: Math.min(100, base.v * 1.2) });
      // Same hue as the other three (monochromatic has none to spare) — a
      // 4th tint variant: notably lighter and softer than accent, rounding
      // out the shade/tint range primary/secondary/accent don't cover.
      quaternary = normalizeHSV({ ...base, s: Math.max(5, base.s * 0.3), v: Math.min(100, base.v * 1.3) });
      break;

    case 'analogous':
      primary = base;
      secondary = shiftHue(base, -hueSpread);
      accent = shiftHue(base, hueSpread);
      // The direct complement (180°) — "analogous + a complementary pop
      // accent" is a standard extension of a 3-hue analogous scheme, giving
      // a 4th color that contrasts with the other three instead of
      // extending the same narrow hue run further.
      quaternary = shiftHue(base, 180);
      break;

    case 'split-complementary':
      primary = base;
      secondary = shiftHue(base, 180 - hueSpread);
      accent = shiftHue(base, 180 + hueSpread);
      // The exact complement itself — split-complementary normally uses
      // only the two hues flanking it; adding the complement gives a 4th,
      // distinct "true opposite" punch color the other three don't cover.
      quaternary = shiftHue(base, 180);
      break;

    case 'triadic':
      primary = base;
      secondary = shiftHue(base, 120);
      accent = shiftHue(base, 240);
      // Triadic's own hues are already evenly spaced (0/120/240) with no
      // room for a 4th evenly-spaced point — the standard way to extend a
      // triadic scheme to 4 colors is adding the base's direct complement
      // (180°) as an accent, distinct from all three existing points.
      quaternary = shiftHue(base, 180);
      break;

    case 'tetradic':
      primary = base;
      secondary = shiftHue(base, hueSpread);
      accent = shiftHue(base, 180);
      // Completes the classic "rectangle" tetradic scheme (base,
      // base+spread, base+180, base+180+spread) — previously this mode
      // only ever produced 3 of its own 4 defining hues.
      quaternary = shiftHue(base, 180 + hueSpread);
      break;
  }

  // Readable text/icon colors for content filled directly on top of each of
  // the four hue-based colors above (e.g. a primary-filled Button's own
  // label) — see pickReadableTextColor's own comment for why a hardcoded
  // white was wrong here (this toolkit's own default primary is a bright
  // lime green; white text on it is close to unreadable).
  const primaryText = pickReadableTextColor(primary);
  const secondaryText = pickReadableTextColor(secondary);
  const accentText = pickReadableTextColor(accent);
  const quaternaryText = pickReadableTextColor(quaternary);

  // Generate Light / Dark mode surfaces and texts
  let bgPrimary: HSVColor;
  let bgSurface: HSVColor;
  let bgContainer: HSVColor;
  let textPrimary: HSVColor;
  let textSecondary: HSVColor;
  let border: HSVColor;
  let focusRing: HSVColor;

  if (isDarkMode) {
    bgPrimary = normalizeHSV({ h: base.h, s: 25, v: 6 });
    bgSurface = normalizeHSV({ h: base.h, s: 20, v: 11 });
    bgContainer = normalizeHSV({ h: base.h, s: 18, v: 16 });

    textPrimary = normalizeHSV({ h: base.h, s: 4, v: 96 });
    // textSecondary is checked against bgContainer, not bgPrimary/bgSurface --
    // bgContainer is the darkest (dark mode) / lightest (light mode) of the
    // three surfaces relative to textSecondary's fixed V, so passing there
    // guarantees the other two surfaces clear the same ratio too. Without
    // this, textSecondary could read as low as 4.21:1 against bgContainer in
    // light mode -- short of WCAG AA's 4.5:1 for normal text, even though it
    // passed comfortably against the other two surfaces. This was previously
    // the one palette role not routed through ensureWCAGContrast at all.
    textSecondary = ensureWCAGContrast(normalizeHSV({ h: base.h, s: 10, v: 72 }), bgContainer, 4.5, isDarkMode);
    border = normalizeHSV({ h: base.h, s: 25, v: 22 });
    focusRing = normalizeHSV({ h: primary.h, s: Math.max(80, primary.s), v: Math.min(100, primary.v * 1.1) });
  } else {
    bgPrimary = normalizeHSV({ h: base.h, s: 4, v: 98 });
    bgSurface = normalizeHSV({ h: base.h, s: 6, v: 100 });
    bgContainer = normalizeHSV({ h: base.h, s: 8, v: 94 });

    textPrimary = normalizeHSV({ h: base.h, s: 20, v: 12 });
    textSecondary = ensureWCAGContrast(normalizeHSV({ h: base.h, s: 15, v: 45 }), bgContainer, 4.5, isDarkMode);
    border = normalizeHSV({ h: base.h, s: 12, v: 85 });
    focusRing = normalizeHSV({ h: primary.h, s: Math.max(60, primary.s), v: Math.max(50, primary.v) });
  }

  // Monochromatic Subthemes carrying base SV axes with WCAG compliance
  const subThemes = {
    error: generateMonochromaticSubTheme(0, base, bgSurface, isDarkMode), // Red (0°)
    success: generateMonochromaticSubTheme(140, base, bgSurface, isDarkMode), // Green (140°)
    warning: generateMonochromaticSubTheme(38, base, bgSurface, isDarkMode), // Amber (38°)
    info: generateMonochromaticSubTheme(210, base, bgSurface, isDarkMode), // Blue (210°)
  };

  return {
    base,
    primary,
    secondary,
    accent,
    quaternary,
    primaryText,
    secondaryText,
    accentText,
    quaternaryText,
    bgPrimary,
    bgSurface,
    bgContainer,
    textPrimary,
    textSecondary,
    border,
    focusRing,
    subThemes,
  };
}

/**
 * Converts a generated palette into a map of CSS custom property names and CSS color/size values.
 */
export function paletteToCSSVariables(
  palette: GeneratedPalette,
  paddingMode: PaddingMode = 'normal',
  cornerRadiusMode: CornerRadiusMode = 'rounded',
  marginMode: MarginMode = 'normal'
): Record<string, string> {
  const paddingVars = getPaddingVariables(paddingMode);
  const marginVars = getMarginVariables(marginMode);
  const radiusVars = getRadiusVariables(cornerRadiusMode);

  return {
    // Fixed (not mode-driven, unlike padding/margin/radius above) — exists
    // so every component's font-weight literal can read from one named
    // scale instead of repeating the bare number, and so a consuming app
    // can retint all of them at once via a single global CSS override
    // without touching component source.
    '--ai-font-weight-normal': '400',
    '--ai-font-weight-medium': '500',
    '--ai-font-weight-semibold': '600',
    '--ai-font-weight-bold': '700',
    '--ai-font-weight-black': '900',
    // Fixed interaction-state constants consumed by interactionStyles.ts's
    // injected :focus-visible rule — named here rather than inlined in that
    // stylesheet so a consumer can retint/resize the ring globally the same
    // way as every other themed value, without editing component source.
    '--ai-focus-ring-width': '0.125rem',
    '--ai-focus-ring-offset': '0.125rem',
    ...paddingVars,
    ...marginVars,
    ...radiusVars,
    '--ai-color-base': hsvToCSS(palette.base),
    '--ai-color-primary': hsvToCSS(palette.primary),
    '--ai-color-primary-text': hsvToCSS(palette.primaryText),
    '--ai-color-secondary': hsvToCSS(palette.secondary),
    '--ai-color-secondary-text': hsvToCSS(palette.secondaryText),
    '--ai-color-accent': hsvToCSS(palette.accent),
    '--ai-color-accent-text': hsvToCSS(palette.accentText),
    '--ai-color-quaternary': hsvToCSS(palette.quaternary),
    '--ai-color-quaternary-text': hsvToCSS(palette.quaternaryText),

    '--ai-bg-primary': hsvToCSS(palette.bgPrimary),
    '--ai-bg-surface': hsvToCSS(palette.bgSurface),
    '--ai-bg-container': hsvToCSS(palette.bgContainer),

    '--ai-text-primary': hsvToCSS(palette.textPrimary),
    '--ai-text-secondary': hsvToCSS(palette.textSecondary),
    '--ai-border': hsvToCSS(palette.border),
    '--ai-focus-ring': hsvToCSS(palette.focusRing),

    // Subthemes (Monochromatic schemes carrying base SV with WCAG compliance)
    '--ai-subtheme-error': hsvToCSS(palette.subThemes.error.main),
    '--ai-subtheme-error-bg': hsvToCSS(palette.subThemes.error.bg),
    '--ai-subtheme-error-border': hsvToCSS(palette.subThemes.error.border),
    '--ai-subtheme-error-text': hsvToCSS(palette.subThemes.error.text),
    '--ai-subtheme-error-on-main': hsvToCSS(palette.subThemes.error.onMain),

    '--ai-subtheme-success': hsvToCSS(palette.subThemes.success.main),
    '--ai-subtheme-success-bg': hsvToCSS(palette.subThemes.success.bg),
    '--ai-subtheme-success-border': hsvToCSS(palette.subThemes.success.border),
    '--ai-subtheme-success-text': hsvToCSS(palette.subThemes.success.text),
    '--ai-subtheme-success-on-main': hsvToCSS(palette.subThemes.success.onMain),

    '--ai-subtheme-warning': hsvToCSS(palette.subThemes.warning.main),
    '--ai-subtheme-warning-bg': hsvToCSS(palette.subThemes.warning.bg),
    '--ai-subtheme-warning-border': hsvToCSS(palette.subThemes.warning.border),
    '--ai-subtheme-warning-text': hsvToCSS(palette.subThemes.warning.text),
    '--ai-subtheme-warning-on-main': hsvToCSS(palette.subThemes.warning.onMain),

    '--ai-subtheme-info': hsvToCSS(palette.subThemes.info.main),
    '--ai-subtheme-info-bg': hsvToCSS(palette.subThemes.info.bg),
    '--ai-subtheme-info-border': hsvToCSS(palette.subThemes.info.border),
    '--ai-subtheme-info-text': hsvToCSS(palette.subThemes.info.text),
    '--ai-subtheme-info-on-main': hsvToCSS(palette.subThemes.info.onMain),
  };
}
