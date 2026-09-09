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
 *
 * The trailing `% 360` (not just the `if (h < 0) h += 360` alone) is
 * load-bearing, found by a real property-based test: for an input h
 * whose magnitude is far smaller than 360's own floating-point
 * precision near that value (~4e-14) -- e.g. h = -5e-324, the smallest
 * representable negative double -- `h += 360` rounds up to exactly
 * `360.0` rather than `359.999...`, silently violating this function's
 * own `[0, 360)` contract (nothing downstream expects h to ever equal
 * 360 exactly). The final `% 360` catches that case too, since
 * `360 % 360 === 0` exactly.
 */
export function normalizeHSV(color: HSVColor): HSVColor {
  let h = color.h % 360;
  if (h < 0) h += 360;
  h = h % 360;
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
 * high-luminance primary color (e.g. a lime-green base, hue ~88°)
 * produced genuinely unreadable white-on-lime text —
 * `ensureWCAGContrast` was never involved in that path at all.
 */
export function pickReadableTextColor(bg: HSVColor): HSVColor {
  const white: HSVColor = { h: 0, s: 0, v: 100 };
  const black: HSVColor = { h: 0, s: 0, v: 0 };
  return getHSVContrastRatio(white, bg) >= getHSVContrastRatio(black, bg) ? white : black;
}

const BISECTION_ITERATIONS = 60;
const BISECTION_EPSILON = 1e-9;
// See ensureWCAGContrast's lighten-branch comment for why this exists --
// absorbs floating-point disagreement between this file's two
// algebraically-equivalent-but-differently-computed contrast formulas.
const LUMINANCE_SAFETY_MARGIN = 1e-9;

/**
 * Finds x in [lo, hi] such that evalLum(x) is as close as possible to
 * target, given evalLum is monotonically non-decreasing over [lo, hi].
 * Plain bisection: no derivative needed, provably converges for any
 * monotonic function (halves the bracket every step, never overshoots
 * it) -- the property that makes it the right tool here, since the real
 * WCAG luminance function (a weighted sum of three independently
 * gamma-corrected channels, see getHSVLuminance) has no general
 * closed-form inverse -- summing multiple non-integer powers (the ^2.4
 * gamma exponent) the way it does isn't algebraically invertible, the
 * same reason x^2.4 + y^2.4 = target has no elementary solution in
 * general. Every call site below is set up so the search variable is
 * monotonically increasing in luminance by construction (never a
 * decreasing one to get backwards), so this one direction is all that's
 * ever needed.
 *
 * Requires evalLum(lo) < target <= evalLum(hi) at the call site (every
 * caller below establishes this before calling in). Returns `b`, the
 * tightest bracket value already known to satisfy the target, not the
 * bracket's midpoint -- the midpoint can land a hair on the wrong side
 * of an exact threshold (confirmed directly: an earlier version
 * returning the midpoint produced a contrast ratio short of its own
 * target by ~1e-11, caught by a regression test asserting the exact
 * boundary), which `b` can't, by the loop's own invariant.
 */
function bisectForLuminance(target: number, evalLum: (x: number) => number, lo: number, hi: number): number {
  let a = lo;
  let b = hi;
  for (let i = 0; i < BISECTION_ITERATIONS && b - a > BISECTION_EPSILON; i++) {
    const mid = (a + b) / 2;
    if (evalLum(mid) < target) a = mid;
    else b = mid;
  }
  return b;
}

/**
 * Adjusts HSV color Value/Saturation to guarantee WCAG compliance
 * against a target background color, preserving hue.
 *
 * Rewritten from a fixed-step iterative loop (±3 Value per step, capped
 * at 30 iterations) after real property-based testing found it silently
 * failed to reach minRatio in ~25% of random cases even when isDarkBg
 * correctly matched bg's real luminance (verified: every real call site
 * in harmonies.ts already derives isDarkBg from the same isDarkMode flag
 * bg itself is built from, so this wasn't a caller-error artifact) --
 * worst case converged to a contrast ratio of ~1.0, the theoretical
 * floor, for a highly-saturated blue/purple foreground starting near
 * Value=0: the fixed step size combined with the 30-iteration cap meant
 * it could run out of iterations *just* short of the Value=95 threshold
 * that would have engaged the old code's own saturation fallback.
 *
 * The fix: for fixed hue and saturation, luminance is provably
 * monotonically non-decreasing in Value (every RGB channel is linear in
 * V; gamma-correction preserves monotonicity), and at Value=100,
 * luminance is provably monotonically non-decreasing as Saturation falls
 * toward 0 (which always reaches white, luminance 1 -- the true ceiling
 * for any hue). Both properties make bisection exact rather than
 * heuristic: it converges to the true root to floating-point precision
 * in ~60 cheap iterations, and by construction can never run out of
 * runway the way a fixed step count could.
 *
 * One real precondition, unchanged from before and worth stating
 * explicitly now rather than leaving implicit: isDarkBg is a caller-
 * supplied stylistic direction (lighten vs. darken), not auto-detected
 * from bg -- both directions can mathematically reach a high ratio from
 * most starting points (crossing below bg's own luminance still
 * increases contrast past that crossover), but only one direction is
 * usually the intended, expected-looking one for a given background.
 * This function still trusts whichever direction the caller asks for; it
 * no longer fails to converge *within* that direction, but a genuinely
 * mismatched isDarkBg (bg actually the opposite of what's claimed) still
 * produces a poor result -- not from a broken loop this time, but
 * because the caller asked to lighten (or darken) into the wrong corner.
 * If minRatio is mathematically unreachable in the requested direction
 * against this specific bg (e.g. minRatio=21 against anything but a
 * literal pure-black/white bg), this converges to the best achievable
 * extreme (black or white) in that direction rather than exactly
 * meeting minRatio -- verify the returned ratio directly via
 * getHSVContrastRatio if a caller ever needs to distinguish "met" from
 * "best effort."
 */
export function ensureWCAGContrast(
  fg: HSVColor,
  bg: HSVColor,
  minRatio: number = 4.5,
  isDarkBg: boolean = false
): HSVColor {
  const normFg = normalizeHSV(fg);
  if (getHSVContrastRatio(normFg, bg) >= minRatio) return normFg;

  const lumBg = getHSVLuminance(bg);

  if (isDarkBg) {
    // Lighten: solve for the luminance fg must reach so that
    // (lumFg + 0.05) / (lumBg + 0.05) >= minRatio. Clamped to 1 (white's
    // own luminance) -- an unreachable minRatio given this bg still
    // converges to the best achievable color (white) instead of an
    // out-of-range target bisection could never reach. The tiny added
    // margin (LUMINANCE_SAFETY_MARGIN) is deliberate, not slack left in
    // by accident: this formula and getHSVContrastRatio's own check
    // (used both by the early-return above and by the real caller who'll
    // verify the result) are algebraically equivalent but computed via a
    // different sequence of floating-point operations, which IEEE 754
    // doesn't guarantee agree to the last bit -- confirmed directly, a
    // version without this margin returned a ratio short of minRatio by
    // ~1e-11 for a real, non-adversarial test case. Aiming the bisection
    // a hair past the exact algebraic boundary costs nothing visually
    // (rounds to the same integer Value/Saturation almost always) and
    // makes the actual, real-formula-verified guarantee hold.
    const targetLum = Math.min(1, minRatio * (lumBg + 0.05) - 0.05 + LUMINANCE_SAFETY_MARGIN);

    // Phase 1: raise Value alone, holding Saturation fixed. Since the
    // early-return above already confirmed the current color falls
    // short, the solution Value is necessarily >= the current one --
    // bisecting [currentV, 100] is both correct and sufficient whenever
    // it's reachable at all at this Saturation.
    const maxLumAtCurrentS = getHSVLuminance({ ...normFg, v: 100 });
    if (maxLumAtCurrentS >= targetLum) {
      const v = bisectForLuminance(targetLum, (v) => getHSVLuminance({ ...normFg, v }), normFg.v, 100);
      return normalizeHSV({ ...normFg, v });
    }

    // Phase 2: Value alone (even at 100) can't reach the target at this
    // Saturation -- desaturate toward white at Value=100 instead. Bisects
    // over "amount of Saturation removed from the current value" (0 = no
    // change, normFg.s = fully desaturated) rather than Saturation
    // itself, so the search variable is monotonically increasing in
    // luminance by construction -- Saturation=0 always reaches luminance
    // 1 (pure white), so this phase is always achievable for any
    // target <= 1.
    const desaturateAmount = bisectForLuminance(
      targetLum,
      (removed) => getHSVLuminance({ h: normFg.h, s: normFg.s - removed, v: 100 }),
      0,
      normFg.s
    );
    return normalizeHSV({ h: normFg.h, s: normFg.s - desaturateAmount, v: 100 });
  }

  // Darken: symmetric, single-phase -- Value=0 always reaches luminance 0
  // (pure black) regardless of hue/Saturation, the true floor, so a
  // single bisection on Value alone is always sufficient (unlike the
  // lighten direction above, darkening never needs a Saturation
  // fallback). The current color falling short of minRatio means the
  // solution Value is necessarily <= the current one.
  // See the lighten branch's own comment on LUMINANCE_SAFETY_MARGIN --
  // same floating-point-path-mismatch reasoning applies symmetrically
  // here, subtracted rather than added since darkening moves the target
  // the other direction.
  const targetLum = Math.max(0, (lumBg + 0.05) / minRatio - 0.05 - LUMINANCE_SAFETY_MARGIN);
  const v = bisectForLuminance(targetLum, (v) => getHSVLuminance({ ...normFg, v }), 0, normFg.v);
  return normalizeHSV({ ...normFg, v });
}

