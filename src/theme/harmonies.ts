import {
  HSVColor,
  normalizeHSV,
  shiftHue,
  adjustSaturation,
  adjustValue,
  applyDarkenLighten,
  hsvToCSS,
  ensureWCAGContrast,
} from './hsv';

import { PaddingMode, getPaddingVariables } from './padding';
import { MarginMode, getMarginVariables } from './margin';
import { CornerRadiusMode, getRadiusVariables } from './radius';

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
  masterFontSize: number; // e.g. 16 (in px, controls all rem scaling)
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
}

export interface GeneratedPalette {
  base: HSVColor;
  primary: HSVColor;
  secondary: HSVColor;
  accent: HSVColor;
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

  return { main, bg, border, text };
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

  switch (harmonyMode) {
    case 'monochromatic':
      primary = base;
      secondary = normalizeHSV({ ...base, v: Math.max(10, base.v * 0.7) });
      accent = normalizeHSV({ ...base, s: Math.min(100, base.s * 1.4), v: Math.min(100, base.v * 1.2) });
      break;

    case 'analogous':
      primary = base;
      secondary = shiftHue(base, -hueSpread);
      accent = shiftHue(base, hueSpread);
      break;

    case 'split-complementary':
      primary = base;
      secondary = shiftHue(base, 180 - hueSpread);
      accent = shiftHue(base, 180 + hueSpread);
      break;

    case 'triadic':
      primary = base;
      secondary = shiftHue(base, 120);
      accent = shiftHue(base, 240);
      break;

    case 'tetradic':
      primary = base;
      secondary = shiftHue(base, hueSpread);
      accent = shiftHue(base, 180);
      break;
  }

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
    textSecondary = normalizeHSV({ h: base.h, s: 10, v: 72 });
    border = normalizeHSV({ h: base.h, s: 25, v: 22 });
    focusRing = normalizeHSV({ h: primary.h, s: Math.max(80, primary.s), v: Math.min(100, primary.v * 1.1) });
  } else {
    bgPrimary = normalizeHSV({ h: base.h, s: 4, v: 98 });
    bgSurface = normalizeHSV({ h: base.h, s: 6, v: 100 });
    bgContainer = normalizeHSV({ h: base.h, s: 8, v: 94 });

    textPrimary = normalizeHSV({ h: base.h, s: 20, v: 12 });
    textSecondary = normalizeHSV({ h: base.h, s: 15, v: 45 });
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
  masterFontSize: number = 16,
  paddingMode: PaddingMode = 'normal',
  cornerRadiusMode: CornerRadiusMode = 'rounded',
  marginMode: MarginMode = 'normal'
): Record<string, string> {
  const paddingVars = getPaddingVariables(paddingMode);
  const marginVars = getMarginVariables(marginMode);
  const radiusVars = getRadiusVariables(cornerRadiusMode);

  return {
    '--ai-master-font-size': `${masterFontSize}px`,
    ...paddingVars,
    ...marginVars,
    ...radiusVars,
    '--ai-color-base': hsvToCSS(palette.base),
    '--ai-color-primary': hsvToCSS(palette.primary),
    '--ai-color-primary-hover': hsvToCSS(adjustValue(palette.primary, 0.9)),
    '--ai-color-secondary': hsvToCSS(palette.secondary),
    '--ai-color-accent': hsvToCSS(palette.accent),

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

    '--ai-subtheme-success': hsvToCSS(palette.subThemes.success.main),
    '--ai-subtheme-success-bg': hsvToCSS(palette.subThemes.success.bg),
    '--ai-subtheme-success-border': hsvToCSS(palette.subThemes.success.border),
    '--ai-subtheme-success-text': hsvToCSS(palette.subThemes.success.text),

    '--ai-subtheme-warning': hsvToCSS(palette.subThemes.warning.main),
    '--ai-subtheme-warning-bg': hsvToCSS(palette.subThemes.warning.bg),
    '--ai-subtheme-warning-border': hsvToCSS(palette.subThemes.warning.border),
    '--ai-subtheme-warning-text': hsvToCSS(palette.subThemes.warning.text),

    '--ai-subtheme-info': hsvToCSS(palette.subThemes.info.main),
    '--ai-subtheme-info-bg': hsvToCSS(palette.subThemes.info.bg),
    '--ai-subtheme-info-border': hsvToCSS(palette.subThemes.info.border),
    '--ai-subtheme-info-text': hsvToCSS(palette.subThemes.info.text),
  };
}
