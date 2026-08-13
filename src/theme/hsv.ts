/**
 * Toolcrib HSV Color Engine
 * All color storage, blending, and shifting is strictly performed in the
 * HSV (Hue, Saturation, Value) color space — colors are never stored or
 * manipulated as RGB anywhere in this engine. The one exception is
 * getHSVLuminance's internal RGB conversion, required because WCAG's own
 * relative-luminance formula is fundamentally defined against RGB channel
 * weights (see that function's own comment for why an HSV-native
 * approximation isn't accurate enough to honor real WCAG guarantees).
 */

/** @barrelExport */
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
 *
 * Identical operation to adjustValue above — kept as its own exported name
 * (call sites read more clearly as "darken/lighten the palette" vs. "scale
 * this specific color's Value") rather than two independently-maintained
 * implementations that could silently drift apart.
 */
export function applyDarkenLighten(color: HSVColor, factor: number): HSVColor {
  return adjustValue(color, factor);
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
 * HSV -> normalized (0..1) sRGB, used only by getHSVLuminance below. WCAG's
 * relative luminance is fundamentally defined against per-channel RGB
 * weights (0.2126/0.7152/0.0722, see getHSVLuminance) — there is no
 * hue-aware way to derive it from HSV alone, so this file's "no RGB
 * calculations" design (see the header comment) is scoped to color
 * storage/blending, not to this one WCAG-mandated exception.
 */
function hsvToRGB01(hsv: HSVColor): [number, number, number] {
  const norm = normalizeHSV(hsv);
  const h = norm.h;
  const s = norm.s / 100;
  const v = norm.v / 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [r + m, g + m, b + m];
}

/**
 * Calculates real WCAG 2.x relative luminance from an HSV color, per the
 * spec's own formula (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance):
 * piecewise-linearized sRGB channels weighted 0.2126/0.7152/0.0722.
 *
 * A previous version computed this from HSV's Lightness channel alone
 * (`V * (1 - S/2)`, gamma-approximated via `Math.pow(L, 2.2)`) with no
 * reference to hue at all — meaning e.g. fully-saturated red, green, and
 * blue at the same S/V all produced the *identical* "luminance", when their
 * real WCAG luminance differs by roughly 10x (green's channel weight alone
 * is ~10x blue's). Verified empirically: at S=85/V=85, the old formula
 * reported a constant contrast ratio of 4.56 against a near-black
 * background across every hue and called all of them WCAG-AA compliant,
 * while the real contrast ranged from 1.89:1 (blue, well below the 4.5:1
 * minimum) to 11.55:1 (yellow) — `ensureWCAGContrast` below, which drives
 * every subtheme's "text" shade (see harmonies.ts's
 * generateMonochromaticSubTheme), was silently accepting real accessibility
 * failures for blue/red/purple-anchored subthemes specifically (i.e. this
 * toolkit's own default error and info subthemes).
 */
export function getHSVLuminance(hsv: HSVColor): number {
  const [r, g, b] = hsvToRGB01(hsv);
  const linearize = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
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
 * Picks whichever of pure black or pure white has higher WCAG contrast
 * against a given background — the right approach for text/icons painted
 * directly on top of a solid, possibly-vivid fill (a filled button, a
 * pressed toggle, a checkbox's own checkmark), as opposed to
 * ensureWCAGContrast below (which nudges a color while preserving its own
 * hue — correct for "themed text on a neutral surface", not "text on a
 * colored fill").
 *
 * Provably meets WCAG AA (>=4.5:1) against *any* background, with no
 * iteration needed: white's contrast rises and black's falls (or vice
 * versa) as background luminance moves away from ~0.179 — the one point
 * where they're equal — so the worse of the two is minimized exactly
 * there, and even at that worst case both already reach ~4.58:1.
 *
 * This is the fix for a real reported case: Button's primary/secondary/
 * danger variants hardcoded white text unconditionally, so a bright
 * high-luminance primary color (e.g. this toolkit's own default lime
 * green, hue ~88°) produced genuinely unreadable white-on-lime text —
 * `ensureWCAGContrast` was never involved in that path at all.
 */
export function pickReadableTextColor(bg: HSVColor): HSVColor {
  const white: HSVColor = { h: 0, s: 0, v: 100 };
  const black: HSVColor = { h: 0, s: 0, v: 0 };
  return getHSVContrastRatio(white, bg) >= getHSVContrastRatio(black, bg) ? white : black;
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

