import { ThemeSnapshot } from './themePersistence';

/**
 * One of three independent theme *sources* (the others: themeLibrary.ts —
 * localStorage, themeFileTransfer.ts — downloaded/uploaded files). Pure
 * bundled data — no logic, no import of `applyThemeSnapshot` or anything
 * from themeContext.tsx. Each preset only specifies `parameters` (the color
 * identity of a theme); component-level slice tweaks are intentionally left
 * alone so applying a preset never resets density/animation/etc. choices
 * the user already made elsewhere.
 */

/** @barrelExport */
export interface PresetTheme {
  id: string;
  name: string;
  snapshot: ThemeSnapshot;
}

export const presetThemes: PresetTheme[] = [
  {
    id: 'tailwind',
    name: '🔷 Tailwind (Default)',
    snapshot: {
      schemaVersion: 1,
      // baseColor is Tailwind CSS's blue-500 (#3b82f6) converted to HSV —
      // the closest this HSV-driven engine gets to "Tailwind compatible":
      // it's already the literal hardcoded fallback on nearly every
      // component's CSS custom properties throughout this codebase (e.g.
      // `var(--ai-color-primary, #3b82f6)`), so this preset is what those
      // components already look like with no ThemeProvider at all — light
      // mode to match Tailwind's own unstyled/base (non-`dark:`) appearance.
      parameters: { baseColor: { h: 217, s: 76, v: 96 }, harmonyMode: 'analogous', hueSpread: 30, isDarkMode: false },
    },
  },
  {
    id: 'lime',
    name: '🍋 Lime',
    snapshot: {
      schemaVersion: 1,
      parameters: { baseColor: { h: 88, s: 78, v: 85 }, harmonyMode: 'analogous', hueSpread: 30, isDarkMode: true },
    },
  },
  {
    id: 'ocean',
    name: '🌊 Ocean Blue',
    snapshot: {
      schemaVersion: 1,
      parameters: { baseColor: { h: 205, s: 75, v: 80 }, harmonyMode: 'analogous', hueSpread: 30, isDarkMode: true },
    },
  },
  {
    id: 'sunset',
    name: '🌅 Sunset Orange',
    snapshot: {
      schemaVersion: 1,
      parameters: { baseColor: { h: 22, s: 85, v: 88 }, harmonyMode: 'split-complementary', hueSpread: 30, isDarkMode: true },
    },
  },
  {
    id: 'royal',
    name: '👑 Royal Purple',
    snapshot: {
      schemaVersion: 1,
      parameters: { baseColor: { h: 265, s: 70, v: 75 }, harmonyMode: 'triadic', hueSpread: 30, isDarkMode: true },
    },
  },
  {
    id: 'forest',
    name: '🌲 Forest Green',
    snapshot: {
      schemaVersion: 1,
      parameters: { baseColor: { h: 145, s: 65, v: 70 }, harmonyMode: 'analogous', hueSpread: 25, isDarkMode: true },
    },
  },
  {
    id: 'daylight',
    name: '☀️ Daylight (Light Mode)',
    snapshot: {
      schemaVersion: 1,
      parameters: { baseColor: { h: 210, s: 80, v: 90 }, harmonyMode: 'analogous', hueSpread: 30, isDarkMode: false },
    },
  },
];
