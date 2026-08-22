import { describe, it, expect } from 'vitest';
import { generateHarmonyPalette, paletteToCSSVariables, type ThemeParameters } from '../theme/harmonies';

describe('Color Harmonies Engine', () => {
  const baseParams: ThemeParameters = {
    baseColor: { h: 210, s: 80, v: 90 },
    harmonyMode: 'analogous',
    hueSpread: 30,
    darkenLightenFactor: 1.0,
    saturationFactor: 1.0,
    paddingMode: 'normal',
    cornerRadiusMode: 'rounded',
    isDarkMode: false,
  };

  it('generates analogous palette', () => {
    const palette = generateHarmonyPalette(baseParams);
    expect(palette.primary.h).toBe(210);
    expect(palette.secondary.h).toBe(180);
    expect(palette.accent.h).toBe(240);
  });

  it('generates triadic palette', () => {
    const palette = generateHarmonyPalette({ ...baseParams, harmonyMode: 'triadic' });
    expect(palette.primary.h).toBe(210);
    expect(palette.secondary.h).toBe(330);
    expect(palette.accent.h).toBe(90);
  });

  it('supports light and dark modes', () => {
    const lightPalette = generateHarmonyPalette({ ...baseParams, isDarkMode: false });
    const darkPalette = generateHarmonyPalette({ ...baseParams, isDarkMode: true });

    expect(lightPalette.bgPrimary.v).toBeGreaterThan(darkPalette.bgPrimary.v);
  });

  it('converts palette to CSS variables map', () => {
    const palette = generateHarmonyPalette(baseParams);
    const vars = paletteToCSSVariables(palette);

    expect(vars['--ai-color-primary']).toBeDefined();
    expect(vars['--ai-subtheme-error']).toBeDefined();
  });

  it('emits a fixed 8-slot chart categorical palette, independent of harmony mode', () => {
    // Monochromatic collapses primary/secondary/accent onto one hue by
    // definition -- the chart series palette must NOT do the same, or a
    // consumer picking this harmony mode would silently break every
    // chart's series-color separation.
    const monoPalette = generateHarmonyPalette({ ...baseParams, harmonyMode: 'monochromatic' });
    const vars = paletteToCSSVariables(monoPalette);

    const seriesHexes = Array.from({ length: 8 }, (_, i) => vars[`--ai-chart-series-${i + 1}`]);
    expect(seriesHexes.every(hex => typeof hex === 'string' && hex.length > 0)).toBe(true);
    expect(new Set(seriesHexes).size).toBe(8);
  });

  it('swaps the chart palette for its dark-mode counterpart', () => {
    const palette = generateHarmonyPalette(baseParams);
    const lightVars = paletteToCSSVariables(palette, 'normal', 'rounded', 'normal', false);
    const darkVars = paletteToCSSVariables(palette, 'normal', 'rounded', 'normal', true);

    expect(lightVars['--ai-chart-series-1']).toBe('#2a78d6');
    expect(darkVars['--ai-chart-series-1']).toBe('#3987e5');
    expect(lightVars['--ai-chart-series-1']).not.toBe(darkVars['--ai-chart-series-1']);
  });
});
