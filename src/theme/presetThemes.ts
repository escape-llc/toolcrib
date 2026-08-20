import { type ThemeSnapshot } from './themePersistence';

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

// Below Tailwind and Daylight: one preset per ROYGBIV color, in wheel
// order, so the bundled set has clear, complete coverage of the color
// wheel rather than an arbitrary/overlapping handful. Two of the seven
// (Spotify Green, Dracula Purple) are, like Tailwind, exact aliases of a
// real, widely-recognized brand/theme color rather than an invented hue —
// same rationale as Tailwind's own comment below: instantly recognizable
// beats another arbitrary swatch, and it's genuinely free to alias here
// since a ROYGBIV slot needs *some* hue in that region regardless.
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
    id: 'red',
    name: '🌹 Rose Red',
    snapshot: {
      schemaVersion: 1,
      parameters: { baseColor: { h: 355, s: 75, v: 82 }, harmonyMode: 'analogous', hueSpread: 30, isDarkMode: true },
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
    id: 'yellow',
    name: '🌻 Sunflower Yellow',
    snapshot: {
      schemaVersion: 1,
      parameters: { baseColor: { h: 48, s: 85, v: 95 }, harmonyMode: 'analogous', hueSpread: 25, isDarkMode: true },
    },
  },
  {
    id: 'green',
    name: '🎧 Spotify Green',
    snapshot: {
      schemaVersion: 1,
      // baseColor is Spotify's brand green (#1DB954) converted to HSV —
      // an alias, same rationale as Tailwind's above. (Coincidentally
      // near-identical to this slot's previous hand-picked "Forest Green"
      // hue, so the visual change from that is minor; the value is now
      // sourced from a real, exact reference rather than approximated.)
      parameters: { baseColor: { h: 141, s: 84, v: 73 }, harmonyMode: 'analogous', hueSpread: 25, isDarkMode: true },
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
    id: 'indigo',
    name: '🧛 Dracula Purple',
    snapshot: {
      schemaVersion: 1,
      // baseColor is the Dracula theme's own "Purple" swatch (#BD93F9)
      // converted to HSV — an alias, same rationale as Tailwind's above.
      // Its hue (~265°) sits at the indigo position on the wheel (between
      // blue at 240° and violet ~285-300°), filling this toolkit's Indigo
      // slot despite Dracula's own name for it; its low saturation/high
      // value versus its ROYGBIV siblings is authentic to Dracula's
      // actual soft-pastel-on-dark look, kept as-is rather than tuned to
      // match the others' richer saturation.
      parameters: { baseColor: { h: 265, s: 41, v: 98 }, harmonyMode: 'triadic', hueSpread: 30, isDarkMode: true },
    },
  },
  {
    id: 'violet',
    name: '💎 Amethyst Violet',
    snapshot: {
      schemaVersion: 1,
      parameters: { baseColor: { h: 295, s: 55, v: 70 }, harmonyMode: 'analogous', hueSpread: 30, isDarkMode: true },
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
