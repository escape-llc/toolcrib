# Worked Example: Translating a Design Brief into `ThemeParameters`

`NEW_APP.md` suggests dropping `<ThemeEditor>` into a running app and
picking a base color/harmony/density interactively, then reading the
result off `useTheme()`. That's the right move when a human is driving.
When you're generating the app yourself, it's usually faster to compute
`ThemeParameters` directly from whatever the user described — no
render-and-inspect round trip needed. This walks through exactly that.

## Every real field

```ts
interface ThemeParameters {
  baseColor: HSVColor;
  harmonyMode: HarmonyMode;
  hueSpread: number;
  darkenLightenFactor: number;
  saturationFactor: number;
  paddingMode: PaddingMode | ResponsiveModeConfig<PaddingMode>;
  marginMode?: MarginMode | ResponsiveModeConfig<MarginMode>;
  cornerRadiusMode: CornerRadiusMode | ResponsiveModeConfig<CornerRadiusMode>;
  isDarkMode: boolean;
}
```

- **`baseColor`** — The one color everything else is generated from, as HSVColor ({ h, s, v }) -- not a hex string.
- **`harmonyMode`** — Which fixed hue-relationship algorithm derives the secondary/accent hues from baseColor.
- **`hueSpread`** — Degrees between generated hues for the modes that use a spread (analogous, split-complementary, tetradic) -- ignored by monochromatic/triadic, which use fixed relationships instead.
- **`darkenLightenFactor`** — Global Value-channel multiplier applied across the generated palette -- 1.0 is neutral, >1 lightens, <1 darkens.
- **`saturationFactor`** — Global Saturation-channel multiplier applied across the generated palette -- 1.0 is neutral.
- **`paddingMode`** — Internal container padding density: 'compact' | 'normal' | 'spacious' (or a responsive per-breakpoint config).
- **`marginMode`** — Spacing between sibling elements: 'compact' | 'normal' | 'spacious' (or a responsive per-breakpoint config).
- **`cornerRadiusMode`** — Corner rounding: 'sharp' | 'subtle' | 'rounded' | 'pill' (or a responsive per-breakpoint config).
- **`isDarkMode`** — Whether the generated palette targets a dark or light surface -- also gates which direction ensureWCAGContrast nudges text toward.

`baseColor` is the only color you ever specify by hand — every other
color in the generated palette (secondary, subthemes, text/border/bg
variants) is derived from it algorithmically via `harmonyMode`. There's
no separate "secondary color" field to fill in.

## Picking `harmonyMode`

The five real values, and when each one fits a brief:

- **`monochromatic`** — One hue throughout, varied only by lightness/saturation. Fits a brief asking for something calm, minimal, or brand-disciplined ("just use our one brand color").
- **`analogous`** — Hues near baseColor on the wheel, spread by hueSpread degrees. A safe general-purpose default (the bundled Tailwind preset uses it) -- cohesive without being flat.
- **`split-complementary`** — baseColor plus two hues near its opposite. Fits a brief wanting real contrast/energy without the harsher clash of a direct complementary pair.
- **`triadic`** — Three hues evenly spaced around the wheel. Fits a brief explicitly asking for a "vibrant" or "playful" feel.
- **`tetradic`** — Four hues, two complementary pairs. The richest/most saturated-feeling option -- fits a brief for something bold, rarely the right default.

## Worked translation

Brief: *"A dark, teal-based theme, on the tighter/denser side, sharp
corners."*

```ts
const initialParameters: ThemeParameters = {
  // "teal-based" -> teal's real hue is ~180deg. HSVColor, not a hex string.
  baseColor: { h: 180, s: 70, v: 70 },
  // No stated preference for "vibrant" or "minimal" -- analogous is the
  // safe general default that stays cohesive with one named hue.
  harmonyMode: 'analogous',
  hueSpread: 30,
  // Neither factor was implied by the brief -- 1.0 (neutral) for both,
  // rather than guessing at an adjustment nothing in the brief asked for.
  darkenLightenFactor: 1.0,
  saturationFactor: 1.0,
  // "tighter/denser" -> compact padding and margin.
  paddingMode: 'compact',
  marginMode: 'compact',
  // "sharp corners" is explicit, not inferred.
  cornerRadiusMode: 'sharp',
  // "dark theme" is explicit.
  isDarkMode: true,
};
```

```tsx
<ThemeProvider initialParameters={initialParameters}>
  {/* ... */}
</ThemeProvider>
```

The app starts pre-themed on first paint — no default-palette flash, no
`<ThemeEditor>` round trip.

## What this deliberately leaves out: component-level slices

`ThemeParameters` is the *palette identity* only. Toolcrib also has
49 independently registered per-component `ThemeSlice`s (already listed
in `component-manifest.json`'s `themeSystem.slices` — e.g. `card`,
`tab`) covering per-component visual tweaks (a specific component's
shadow depth, animation speed, and similar). This example doesn't cover
those on purpose: `theme/presetThemes.ts`'s own bundled presets only ever
set `parameters`, never per-slice state, specifically so applying a
preset never resets a density/animation/etc. choice made elsewhere — the
same convention this worked example follows. If a brief calls for a
specific component-level tweak beyond the global palette, that's a
`ThemeSlice` override passed as that component's own `overrides` prop
(see CORE.md §10 and the `overrides-and-style-domains` worked example),
a separate mechanism from anything here.
