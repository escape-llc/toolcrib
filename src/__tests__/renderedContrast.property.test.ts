import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  ensureRenderedWCAGContrast,
  getRenderedContrastRatio,
  quantizeToCSS,
  mixHSVInSRGB,
  hsvToCSS,
  type HSVColor,
} from '../theme/hsv';
import { generateHarmonyPalette, type HarmonyMode } from '../theme/harmonies';
import { defaultParameters } from '../theme/serverThemeCSS';

// axe-core 4.14 reading real pixels showed the palette's "4.5:1" secondary
// text measuring 4.42:1 on screen: hsvToCSS rounds saturation/lightness to
// whole percents and the browser rounds each channel to 8 bits, so a color
// placed exactly on the boundary can land under it. These pin the
// guarantee on the colors as rendered.

const finiteDouble = (min: number, max: number) => fc.double({ min, max, noNaN: true, noDefaultInfinity: true });
const hsv = fc.record({ h: finiteDouble(0, 360), s: finiteDouble(0, 100), v: finiteDouble(0, 100) });

describe('quantizeToCSS', () => {
  it('is idempotent and stays in range', () => {
    fc.assert(
      fc.property(hsv, (c) => {
        const q = quantizeToCSS(c);
        expect(q.s).toBeGreaterThanOrEqual(0);
        expect(q.v).toBeLessThanOrEqual(100.0000001);
        // quantizing again lands on the same CSS string
        expect(hsvToCSS(quantizeToCSS(q))).toBe(hsvToCSS(q));
      }),
      { numRuns: 2000 }
    );
  });
});

describe('ensureRenderedWCAGContrast', () => {
  it('meets the ratio on the rendered colors for realistic surfaces, light and dark', () => {
    const lightBg = fc.record({ h: finiteDouble(0, 360), s: finiteDouble(0, 30), v: finiteDouble(88, 100) });
    const darkBg = fc.record({ h: finiteDouble(0, 360), s: finiteDouble(0, 40), v: finiteDouble(4, 22) });
    fc.assert(
      fc.property(hsv, lightBg, fc.constantFrom(3.0, 4.5), (fg, bg, min) => {
        const out = ensureRenderedWCAGContrast(fg, bg, min, false);
        expect(getRenderedContrastRatio(out, bg)).toBeGreaterThanOrEqual(min);
      }),
      { numRuns: 3000 }
    );
    fc.assert(
      fc.property(hsv, darkBg, fc.constantFrom(3.0, 4.5), (fg, bg, min) => {
        const out = ensureRenderedWCAGContrast(fg, bg, min, true);
        expect(getRenderedContrastRatio(out, bg)).toBeGreaterThanOrEqual(min);
      }),
      { numRuns: 3000 }
    );
  });
});

describe('mixHSVInSRGB', () => {
  it('is the first color at 100%, the second at 0%, and stays in range', () => {
    fc.assert(
      fc.property(hsv, hsv, (a, b) => {
        const at100 = mixHSVInSRGB(a, b, 100);
        const at0 = mixHSVInSRGB(a, b, 0);
        expect(getRenderedContrastRatio(at100, a)).toBeCloseTo(1, 1);
        expect(getRenderedContrastRatio(at0, b)).toBeCloseTo(1, 1);
        const mid = mixHSVInSRGB(a, b, 12);
        expect(mid.s).toBeGreaterThanOrEqual(0);
        expect(mid.s).toBeLessThanOrEqual(100.0001);
        expect(mid.v).toBeLessThanOrEqual(100.0001);
      }),
      { numRuns: 1000 }
    );
  });
});

describe('generated palette: text roles clear 4.5:1 as rendered, on the darkest surface they sit on', () => {
  const modes: HarmonyMode[] = ['monochromatic', 'analogous', 'split-complementary', 'triadic', 'tetradic'];
  const base: fc.Arbitrary<HSVColor> = fc.record({ h: finiteDouble(0, 360), s: finiteDouble(20, 100), v: finiteDouble(30, 100) });

  it.each([false, true])('isDarkMode=%s', (isDarkMode) => {
    fc.assert(
      fc.property(base, fc.constantFrom(...modes), (baseColor, harmonyMode) => {
        const p = generateHarmonyPalette({ ...defaultParameters, baseColor, harmonyMode, isDarkMode });
        expect(getRenderedContrastRatio(p.textSecondary, p.bgContainer)).toBeGreaterThanOrEqual(4.5);
        expect(getRenderedContrastRatio(p.primaryReadable, p.bgContainer)).toBeGreaterThanOrEqual(4.5);
        expect(getRenderedContrastRatio(p.secondaryReadable, p.bgContainer)).toBeGreaterThanOrEqual(4.5);
        // colorVariant.ts's soft appearance paints 12% of the identity color over the surface
        expect(getRenderedContrastRatio(p.primaryReadable, mixHSVInSRGB(p.primary, p.bgSurface, 12))).toBeGreaterThanOrEqual(4.5);
        expect(getRenderedContrastRatio(p.secondaryReadable, mixHSVInSRGB(p.secondary, p.bgSurface, 12))).toBeGreaterThanOrEqual(4.5);
      }),
      { numRuns: 400 }
    );
  });
});
