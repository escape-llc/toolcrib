import { describe, it, expect } from 'vitest';
import { normalizeHSV, shiftHue, adjustSaturation, applyDarkenLighten, hsvToCSS, hexToHSV } from '../theme/hsv';

describe('HSV Color Engine', () => {
  it('normalizes HSV values correctly', () => {
    const norm = normalizeHSV({ h: 390, s: 150, v: -20 });
    expect(norm.h).toBe(30);
    expect(norm.s).toBe(100);
    expect(norm.v).toBe(0);
  });

  it('shifts hue by delta angle', () => {
    const shifted = shiftHue({ h: 350, s: 80, v: 90 }, 30);
    expect(shifted.h).toBe(20);
  });

  it('adjusts saturation and value by factors', () => {
    const sat = adjustSaturation({ h: 200, s: 50, v: 80 }, 1.5);
    expect(sat.s).toBe(75);

    const val = applyDarkenLighten({ h: 200, s: 50, v: 80 }, 0.5);
    expect(val.v).toBe(40);
  });

  it('converts HSV to HSL CSS color strings without RGB math', () => {
    const css = hsvToCSS({ h: 0, s: 100, v: 100 });
    expect(css).toContain('hsl(0');
  });

  it('parses hex to HSV', () => {
    const hsv = hexToHSV('#ff0000');
    expect(hsv.h).toBe(0);
    expect(hsv.s).toBe(100);
    expect(hsv.v).toBe(100);
  });
});
