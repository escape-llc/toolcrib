import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  normalizeHSV,
  shiftHue,
  adjustSaturation,
  adjustValue,
  hexToHSV,
  hsvToCSS,
  getHSVLuminance,
  getHSVContrastRatio,
  ensureWCAGContrast,
  type HSVColor,
} from '../theme/hsv';

// Property-based tests, added after a real bug was found this way: the
// previous ensureWCAGContrast (a fixed-step loop, +/-3 Value per step,
// capped at 30 iterations) silently failed to reach its own promised
// minRatio in ~25% of random cases even when isDarkBg correctly matched
// bg's real luminance -- worst case converged to a contrast ratio of
// ~1.0 (the theoretical floor) instead of the ~4.5-6 it was asked for.
// Rewritten as an exact bisection (see hsv.ts's own comments on why
// bisection, not a closed-form formula, is the right tool here -- the
// underlying WCAG luminance function sums multiple gamma-corrected
// terms with no general algebraic inverse). These tests are the
// permanent regression coverage for that fix, not just a one-time check.

const finiteDouble = (min: number, max: number) => fc.double({ min, max, noNaN: true, noDefaultInfinity: true });

const hsvArb: fc.Arbitrary<HSVColor> = fc.record({
  h: finiteDouble(-1000, 1000), // deliberately outside [0,360) -- normalizeHSV must handle it
  s: finiteDouble(-1000, 1000),
  v: finiteDouble(-1000, 1000),
});

const normalizedHsvArb: fc.Arbitrary<HSVColor> = fc.record({
  h: finiteDouble(0, 360),
  s: finiteDouble(0, 100),
  v: finiteDouble(0, 100),
});

describe('normalizeHSV (property)', () => {
  it('always returns h in [0, 360) and s/v in [0, 100], for any finite input', () => {
    fc.assert(
      fc.property(hsvArb, (color) => {
        const result = normalizeHSV(color);
        expect(result.h).toBeGreaterThanOrEqual(0);
        expect(result.h).toBeLessThan(360);
        expect(result.s).toBeGreaterThanOrEqual(0);
        expect(result.s).toBeLessThanOrEqual(100);
        expect(result.v).toBeGreaterThanOrEqual(0);
        expect(result.v).toBeLessThanOrEqual(100);
        expect(Number.isNaN(result.h)).toBe(false);
        expect(Number.isNaN(result.s)).toBe(false);
        expect(Number.isNaN(result.v)).toBe(false);
      })
    );
  });
});

describe('shiftHue / adjustSaturation / adjustValue (property)', () => {
  it('never produce a NaN or out-of-range channel for any finite input', () => {
    fc.assert(
      fc.property(normalizedHsvArb, finiteDouble(-1000, 1000), (color, delta) => {
        for (const result of [shiftHue(color, delta), adjustSaturation(color, delta), adjustValue(color, delta)]) {
          expect(Number.isNaN(result.h)).toBe(false);
          expect(Number.isNaN(result.s)).toBe(false);
          expect(Number.isNaN(result.v)).toBe(false);
          expect(result.s).toBeGreaterThanOrEqual(0);
          expect(result.s).toBeLessThanOrEqual(100);
          expect(result.v).toBeGreaterThanOrEqual(0);
          expect(result.v).toBeLessThanOrEqual(100);
        }
      })
    );
  });
});

describe('hexToHSV (property)', () => {
  const hexDigit = fc.constantFrom(...'0123456789abcdefABCDEF'.split(''));

  it('never produces a NaN or out-of-range color for any 3- or 6-digit hex string', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.array(hexDigit, { minLength: 3, maxLength: 3 }).map((d) => '#' + d.join('')),
          fc.array(hexDigit, { minLength: 6, maxLength: 6 }).map((d) => '#' + d.join(''))
        ),
        (hex) => {
          const result = hexToHSV(hex);
          expect(Number.isNaN(result.h)).toBe(false);
          expect(Number.isNaN(result.s)).toBe(false);
          expect(Number.isNaN(result.v)).toBe(false);
          expect(result.h).toBeGreaterThanOrEqual(0);
          expect(result.h).toBeLessThan(360);
        }
      )
    );
  });
});

describe('hsvToCSS (property)', () => {
  it('always returns a well-formed hsl()/hsla() string for any normalized color', () => {
    fc.assert(
      fc.property(normalizedHsvArb, finiteDouble(0, 1), (color, alpha) => {
        const css = hsvToCSS(color, alpha);
        // Scientific notation (e.g. "5e-324") is valid CSS <number> syntax
        // per CSS Syntax Level 3 -- confirmed directly against the spec
        // before loosening this regex, not assumed. Real alpha values in
        // this codebase are always clean literals (0.5, 0.9, ...), never
        // a denormalized-double artifact, so this only needs to allow
        // for it, not specifically generate it as a realistic case.
        expect(css).toMatch(alpha < 1 ? /^hsla\(-?\d+, \d+%, \d+%, .+\)$/ : /^hsl\(-?\d+, \d+%, \d+%\)$/);
      })
    );
  });
});

describe('ensureWCAGContrast (property) -- the regression coverage for the real bug this was rewritten to fix', () => {
  const fgArb = normalizedHsvArb;
  // Mirrors how harmonies.ts actually builds backgrounds: genuinely low V
  // in dark mode, genuinely high V in light mode -- never a borderline
  // luminance an arbitrary threshold could misclassify. The bug this
  // guards against reproduced at ~25% even with this exact shape before
  // the bisection rewrite; catching it needs a generator this close to
  // real usage, not just a maximally adversarial one (see the second
  // test below for that).
  const realisticCaseArb = fc.record({
    fg: fgArb,
    isDarkMode: fc.boolean(),
    bgHue: finiteDouble(0, 360),
    bgSat: finiteDouble(0, 100),
    bgVFraction: finiteDouble(0, 1),
    minRatio: fc.constantFrom(3.0, 4.5),
  });

  it('always reaches minRatio for realistic, harmonies.ts-shaped call sites', () => {
    fc.assert(
      fc.property(realisticCaseArb, ({ fg, isDarkMode, bgHue, bgSat, bgVFraction, minRatio }) => {
        const bg: HSVColor = isDarkMode
          ? { h: bgHue, s: bgSat * 0.3, v: bgVFraction * 20 }
          : { h: bgHue, s: bgSat * 0.15, v: 85 + bgVFraction * 15 };
        const result = ensureWCAGContrast(fg, bg, minRatio, isDarkMode);
        expect(getHSVContrastRatio(result, bg)).toBeGreaterThanOrEqual(minRatio);
      }),
      { numRuns: 2000 }
    );
  });

  it('leaves an already-compliant color unchanged (no unnecessary adjustment)', () => {
    fc.assert(
      fc.property(fgArb, normalizedHsvArb, fc.boolean(), fc.constantFrom(3.0, 4.5), (fg, bg, isDarkBg, minRatio) => {
        if (getHSVContrastRatio(fg, bg) < minRatio) return; // not the case this test targets
        expect(ensureWCAGContrast(fg, bg, minRatio, isDarkBg)).toEqual(normalizeHSV(fg));
      })
    );
  });

  it('adversarial: whenever the result falls short of minRatio, it is provably the true theoretical ceiling in the requested direction, never a convergence failure', () => {
    fc.assert(
      fc.property(fgArb, normalizedHsvArb, fc.boolean(), finiteDouble(1, 21), (fg, bg, isDarkBg, minRatio) => {
        const result = ensureWCAGContrast(fg, bg, minRatio, isDarkBg);
        const ratio = getHSVContrastRatio(result, bg);
        if (ratio >= minRatio - 1e-6) return; // met the target -- nothing further to check

        const extreme: HSVColor = isDarkBg ? { h: fg.h, s: 0, v: 100 } : { h: fg.h, s: fg.s, v: 0 };
        const theoreticalBest = getHSVContrastRatio(extreme, bg);
        expect(Math.abs(ratio - theoreticalBest)).toBeLessThan(1e-3);
      }),
      { numRuns: 5000 }
    );
  });
});

describe('getHSVLuminance / getHSVContrastRatio (property)', () => {
  it('luminance is always in [0, 1] and contrast ratio is always in [1, 21]', () => {
    fc.assert(
      fc.property(normalizedHsvArb, normalizedHsvArb, (a, b) => {
        const lumA = getHSVLuminance(a);
        expect(lumA).toBeGreaterThanOrEqual(0);
        expect(lumA).toBeLessThanOrEqual(1);
        const ratio = getHSVContrastRatio(a, b);
        expect(ratio).toBeGreaterThanOrEqual(1);
        expect(ratio).toBeLessThanOrEqual(21);
      })
    );
  });
});
