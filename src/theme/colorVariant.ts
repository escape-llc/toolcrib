import { resolveSubtheme, type SubthemeName } from './subtheme';

/**
 * Identity color from the harmony palette — distinct from `SubthemeName`'s
 * 4 fixed-hue status colors. Only `primary`/`secondary` for now, matching
 * `Button`'s own existing `variant` surface (which doesn't expose `accent`/
 * `quaternary` either) rather than inventing a broader set nothing else in
 * the toolkit exposes yet.
 * @barrelExport
 */
export type ColorVariant = 'primary' | 'secondary';

/**
 * Visual treatment, orthogonal to color source (`variant`/`subtheme`).
 * `'soft'` — tinted background + border + colored text on a neutral
 * surface (the look every subtheme-colored `Badge` already had before this
 * module existed — the default, so adding `appearance` never changes
 * anyone's current output). `'solid'` — filled with the color, readable
 * text on top. `'outline'` — transparent background, colored border+text
 * ("hollow").
 * @barrelExport
 */
export type Appearance = 'soft' | 'solid' | 'outline';

/** @barrelExport */
export interface ResolvedColorVariant {
  background: string;
  border: string;
  color: string;
}

// No precomputed soft-tint/neutral-surface-readable-text pair exists for
// identity colors the way SubthemeColors' own `.background`/`.border`/
// `.color` fields do (that richness -- WCAG-contrast-checked derivation --
// is specific to the 4 status subthemes, generated in harmonies.ts).
// Building an equivalent precomputed family for primary/secondary was
// considered and rejected as disproportionate to what a Badge/Toast needs;
// color-mix() derives a working (not WCAG-verified) soft tint live
// instead. Text/border for identity colors uses the raw `main` hue
// directly, same as Button's own pre-existing outline/ghost variants
// already do for primary/secondary -- not a new tradeoff, just reused.
const IDENTITY_COLOR_VARS: Record<ColorVariant, { main: string; onMain: string }> = {
  primary: { main: 'var(--ai-color-primary)', onMain: 'var(--ai-color-primary-text)' },
  secondary: { main: 'var(--ai-color-secondary)', onMain: 'var(--ai-color-secondary-text)' },
};

function applyAppearance(appearance: Appearance, main: string, onMain: string, softBackground: string, softBorder: string, softColor: string): ResolvedColorVariant {
  switch (appearance) {
    case 'solid':
      return { background: main, border: main, color: onMain };
    case 'outline':
      return { background: 'transparent', border: main, color: main };
    case 'soft':
    default:
      return { background: softBackground, border: softBorder, color: softColor };
  }
}

/**
 * Resolves a component's `variant`/`appearance`/`subtheme` combination into
 * a concrete background/border/color triple — the shared standard behind
 * every "status pill"-style component's color options (`Badge` today;
 * `Toast` reuses it internally for its own existing 4-color lookup), so
 * each doesn't hand-roll its own switch statement over the same 4 subtheme
 * names. `subtheme` wins over `variant` when both are set — matching
 * `Button`'s own existing precedent, where its `subtheme` prop already
 * overrides `variant`'s color the same way. Returns `null` when neither is
 * set, so the caller applies its own neutral default — this module has no
 * opinion on what "no color chosen" looks like for a given component.
 * @barrelExport
 */
export function resolveColorVariant(options: { variant?: ColorVariant; appearance?: Appearance; subtheme?: SubthemeName }): ResolvedColorVariant | null {
  const { variant, appearance = 'soft', subtheme } = options;

  if (subtheme) {
    const colors = resolveSubtheme(subtheme);
    return applyAppearance(appearance, colors.main, colors.onMain, colors.background, colors.border, colors.color);
  }
  if (variant) {
    const { main, onMain } = IDENTITY_COLOR_VARS[variant];
    const softBackground = `color-mix(in srgb, ${main} 12%, var(--ai-bg-surface, #ffffff))`;
    const softBorder = `color-mix(in srgb, ${main} 35%, transparent)`;
    return applyAppearance(appearance, main, onMain, softBackground, softBorder, main);
  }
  return null;
}
