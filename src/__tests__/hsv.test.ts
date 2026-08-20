import { describe, it, expect } from 'vitest';
import { getHSVLuminance, getHSVContrastRatio, ensureWCAGContrast, pickReadableTextColor, type HSVColor } from '../theme/hsv';

// Reference values are the well-known WCAG relative luminance figures for
// pure white/black/red/green/blue (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance) —
// e.g. pure red's luminance is exactly its own R-channel weight (0.2126)
// since R=1, G=0, B=0 and R's linearized value at full intensity is 1.
describe('getHSVLuminance (real WCAG relative luminance, not the HSV-Lightness approximation)', () => {
  it('white is 1.0, black is 0.0', () => {
    expect(getHSVLuminance({ h: 0, s: 0, v: 100 })).toBeCloseTo(1.0, 4);
    expect(getHSVLuminance({ h: 0, s: 0, v: 0 })).toBeCloseTo(0.0, 4);
  });

  it('matches the published per-channel luminance weights for pure red/green/blue', () => {
    expect(getHSVLuminance({ h: 0, s: 100, v: 100 })).toBeCloseTo(0.2126, 4);
    expect(getHSVLuminance({ h: 120, s: 100, v: 100 })).toBeCloseTo(0.7152, 4);
    expect(getHSVLuminance({ h: 240, s: 100, v: 100 })).toBeCloseTo(0.0722, 4);
  });

  it('is hue-sensitive — same S/V, different hues, meaningfully different luminance', () => {
    // Regression guard for the bug this replaced: the old formula derived
    // luminance from HSV's Lightness channel alone (hue-blind), so pure red
    // and pure blue at identical S/V reported identical luminance. Real
    // luminance differs by ~3x between them (0.2126 vs 0.0722).
    const red = getHSVLuminance({ h: 0, s: 100, v: 100 });
    const blue = getHSVLuminance({ h: 240, s: 100, v: 100 });
    const yellow = getHSVLuminance({ h: 60, s: 100, v: 100 });
    expect(red).not.toBeCloseTo(blue, 2);
    expect(yellow).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe('getHSVContrastRatio', () => {
  it('white on black is the maximum 21:1', () => {
    const white: HSVColor = { h: 0, s: 0, v: 100 };
    const black: HSVColor = { h: 0, s: 0, v: 0 };
    expect(getHSVContrastRatio(white, black)).toBeCloseTo(21, 0);
  });

  it('a color against itself is always 1:1', () => {
    const c: HSVColor = { h: 210, s: 70, v: 55 };
    expect(getHSVContrastRatio(c, c)).toBeCloseTo(1, 4);
  });

  it('is symmetric regardless of argument order', () => {
    const a: HSVColor = { h: 30, s: 80, v: 90 };
    const b: HSVColor = { h: 0, s: 0, v: 5 };
    expect(getHSVContrastRatio(a, b)).toBeCloseTo(getHSVContrastRatio(b, a), 6);
  });
});

describe('ensureWCAGContrast', () => {
  it('leaves an already-compliant color unchanged', () => {
    const white: HSVColor = { h: 0, s: 0, v: 100 };
    const black: HSVColor = { h: 0, s: 0, v: 0 };
    const result = ensureWCAGContrast(white, black, 4.5, true);
    expect(result).toEqual(white);
  });

  it('adjusts a genuinely non-compliant blue-hued color until it actually passes 4.5:1 against a dark background', () => {
    // This exact case (blue, high S/V, dark bg) is what the old formula got
    // wrong — it reported ~4.56:1 (a false pass) when the real ratio was
    // 1.89:1. Asserting the *real* getHSVContrastRatio (now accurate) on
    // the adjusted result is the actual regression guard: it fails again if
    // the luminance calculation regresses back to hue-blind.
    const bg: HSVColor = { h: 0, s: 0, v: 10 };
    const blueFg: HSVColor = { h: 240, s: 85, v: 85 };
    expect(getHSVContrastRatio(blueFg, bg)).toBeLessThan(4.5);

    const adjusted = ensureWCAGContrast(blueFg, bg, 4.5, true);
    expect(getHSVContrastRatio(adjusted, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('adjusts a red-hued color for a light background by darkening instead of lightening', () => {
    const bg: HSVColor = { h: 0, s: 0, v: 98 };
    const redFg: HSVColor = { h: 0, s: 90, v: 90 };
    const adjusted = ensureWCAGContrast(redFg, bg, 4.5, false);
    expect(getHSVContrastRatio(adjusted, bg)).toBeGreaterThanOrEqual(4.5);
    expect(adjusted.v).toBeLessThanOrEqual(redFg.v);
  });
});

describe('pickReadableTextColor', () => {
  it('picks black for a bright, high-luminance background (e.g. lime green)', () => {
    // The exact reported case that motivated pickReadableTextColor: a
    // bright lime green base (hue ~88°) — white text on it is close to
    // unreadable, since lime's luminance is already close to white's.
    const lime: HSVColor = { h: 88, s: 78, v: 85 };
    const result = pickReadableTextColor(lime);
    expect(result.v).toBe(0); // black
  });

  it('picks white for a dark, low-luminance background', () => {
    const darkBlue: HSVColor = { h: 220, s: 80, v: 25 };
    const result = pickReadableTextColor(darkBlue);
    expect(result.v).toBe(100); // white
  });

  it('always meets WCAG AA (>=4.5:1) against any background, across the full hue range', () => {
    for (let h = 0; h < 360; h += 15) {
      for (const v of [10, 30, 50, 70, 90]) {
        const bg: HSVColor = { h, s: 80, v };
        const text = pickReadableTextColor(bg);
        expect(getHSVContrastRatio(text, bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
