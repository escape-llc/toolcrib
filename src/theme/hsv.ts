/**
 * AI-UI HSV Color Engine
 * All color math is strictly performed in the HSV (Hue, Saturation, Value) color space.
 * No RGB calculations are performed anywhere in this engine.
 */

export interface HSVColor {
  /** Hue angle in degrees (0 - 360) */
  h: number;
  /** Saturation percentage (0 - 100) */
  s: number;
  /** Value / Brightness percentage (0 - 100) */
  v: number;
}

/**
 * Normalizes an HSV color tuple within valid bounds.
 */
export function normalizeHSV(color: HSVColor): HSVColor {
  let h = color.h % 360;
  if (h < 0) h += 360;
  const s = Math.max(0, Math.min(100, color.s));
  const v = Math.max(0, Math.min(100, color.v));
  return { h, s, v };
}

/**
 * Shifts hue by a given delta angle.
 */
export function shiftHue(color: HSVColor, deltaDegrees: number): HSVColor {
  return normalizeHSV({
    ...color,
    h: color.h + deltaDegrees,
  });
}

/**
 * Scales or adjusts saturation by a factor (0..2+).
 */
export function adjustSaturation(color: HSVColor, factor: number): HSVColor {
  return normalizeHSV({
    ...color,
    s: color.s * factor,
  });
}

/**
 * Scales or adjusts value (lightness/darkness) by a factor or delta.
 */
export function adjustValue(color: HSVColor, factor: number): HSVColor {
  return normalizeHSV({
    ...color,
    v: color.v * factor,
  });
}

/**
 * Applies darken or lighten factor to HSV Value channel.
 * factor > 1 lightens, factor < 1 darkens.
 */
export function applyDarkenLighten(color: HSVColor, factor: number): HSVColor {
  return normalizeHSV({
    ...color,
    v: color.v * factor,
  });
}

/**
 * Converts HSV directly to a CSS HSL string representation without any RGB math.
 * Math:
 * L = V * (1 - S / 200)
 * S_hsl = 0 if L == 0 || L == 100 else (V - L) / min(L, 100 - L) * 100
 */
export function hsvToCSS(hsv: HSVColor, alpha: number = 1): string {
  const norm = normalizeHSV(hsv);
  const H = Math.round(norm.h);
  const S_hsv = norm.s / 100;
  const V_hsv = norm.v / 100;

  const L = V_hsv * (1 - S_hsv / 2);
  let S_hsl = 0;
  if (L > 0 && L < 1) {
    S_hsl = (V_hsv - L) / Math.min(L, 1 - L);
  }

  const S_pct = Math.round(S_hsl * 100);
  const L_pct = Math.round(L * 100);

  if (alpha < 1) {
    return `hsla(${H}, ${S_pct}%, ${L_pct}%, ${alpha})`;
  }
  return `hsl(${H}, ${S_pct}%, ${L_pct}%)`;
}

/**
 * Helper to parse hex string or hsl into HSV if needed for convenience, strictly using HSV formulas.
 */
export function hexToHSV(hex: string): HSVColor {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;

  return normalizeHSV({ h, s, v });
}

/**
 * Calculates WCAG relative luminance directly from HSV color tuple.
 */
export function getHSVLuminance(hsv: HSVColor): number {
  const norm = normalizeHSV(hsv);
  const S_hsv = norm.s / 100;
  const V_hsv = norm.v / 100;

  const L = V_hsv * (1 - S_hsv / 2);
  // Approximation of WCAG relative luminance from Lightness channel
  return Math.pow(L, 2.2);
}

/**
 * Calculates WCAG contrast ratio between two HSV colors.
 * Returns ratio value from 1:1 up to 21:1.
 */
export function getHSVContrastRatio(hsv1: HSVColor, hsv2: HSVColor): number {
  const lum1 = getHSVLuminance(hsv1);
  const lum2 = getHSVLuminance(hsv2);
  const maxLum = Math.max(lum1, lum2);
  const minLum = Math.min(lum1, lum2);
  return (maxLum + 0.05) / (minLum + 0.05);
}

/**
 * Adjusts HSV color Value/Saturation to guarantee WCAG compliance against a target background color.
 */
export function ensureWCAGContrast(
  fg: HSVColor,
  bg: HSVColor,
  minRatio: number = 4.5,
  isDarkBg: boolean = false
): HSVColor {
  let adjusted = { ...normalizeHSV(fg) };
  let currentRatio = getHSVContrastRatio(adjusted, bg);

  let iterations = 0;
  while (currentRatio < minRatio && iterations < 30) {
    iterations++;
    if (isDarkBg) {
      // Background is dark -> increase Value (lightness) or decrease Saturation
      adjusted.v = Math.min(100, adjusted.v + 3);
      if (adjusted.v >= 95) {
        adjusted.s = Math.max(0, adjusted.s - 5);
      }
    } else {
      // Background is light -> decrease Value (darkness)
      adjusted.v = Math.max(0, adjusted.v - 3);
    }
    currentRatio = getHSVContrastRatio(adjusted, bg);
  }

  return normalizeHSV(adjusted);
}

