import { describe, it, expect } from 'vitest';
import { generateHarmonyPalette, paletteToCSSVariables, ThemeParameters } from '../theme/harmonies';

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
});
