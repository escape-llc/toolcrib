import { type PaddingMode, getPaddingVariables } from './padding';
import { type MarginMode, getMarginVariables } from './margin';
import { type CornerRadiusMode, getRadiusVariables } from './radius';

/**
 * A fixed, named breakpoint scale — deliberately not arbitrary pixel
 * values a caller picks per instance, matching every other "mode" prop
 * in this theme system (PaddingMode/MarginMode/CornerRadiusMode). Values
 * chosen to be familiar to anyone coming from Tailwind's own default
 * scale (see TAILWIND.md), not because this system derives from it.
 * @barrelExport
 */
export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

export const BREAKPOINTS: Record<Breakpoint, number> = { sm: 640, md: 768, lg: 1024, xl: 1280 };

// Ascending order is load-bearing, not cosmetic -- generateResponsiveCSS
// emits one @media (min-width: ...) block per configured tier in this
// order, and CSS's own "min-width" queries all stay simultaneously true
// once crossed (they aren't mutually exclusive ranges), so a wider
// viewport's block winning is entirely a product of it being LATER in
// source order at equal specificity, not anything this code decides at
// runtime.
export const BREAKPOINT_ORDER: readonly Breakpoint[] = ['sm', 'md', 'lg', 'xl'];

/**
 * A mode value that's either a single static setting (today's existing
 * behavior, unchanged) or varies by breakpoint. `base` is unconditional --
 * also the SSR/first-paint value, since it's what ThemeProvider's regular
 * inline-variable path uses before any @media block can apply.
 * @barrelExport
 */
export interface ResponsiveModeConfig<TMode extends string> {
  base: TMode;
  sm?: TMode;
  md?: TMode;
  lg?: TMode;
  xl?: TMode;
}

export function isResponsiveConfig<TMode extends string>(
  value: TMode | ResponsiveModeConfig<TMode> | undefined
): value is ResponsiveModeConfig<TMode> {
  return typeof value === 'object' && value !== null && 'base' in value;
}

export function resolveBaseMode<TMode extends string>(value: TMode | ResponsiveModeConfig<TMode>): TMode {
  return isResponsiveConfig(value) ? value.base : value;
}

/** The subset of ThemeParameters' mode fields that can be placed under responsive control. */
export interface ResponsiveThemeInput {
  padding?: ResponsiveModeConfig<PaddingMode>;
  margin?: ResponsiveModeConfig<MarginMode>;
  radius?: ResponsiveModeConfig<CornerRadiusMode>;
}

function formatDeclarations(vars: Record<string, string>, indent: string): string {
  return Object.entries(vars)
    .map(([key, value]) => `${indent}${key}: ${value};`)
    .join('\n');
}

/**
 * Every CSS variable name any of the three mode families can emit, for
 * whichever families are configured in `input` -- every mode variant of
 * a given family shares the exact same key set (only values differ), so
 * this only needs one representative call (`.base`) per configured
 * family, not one per tier. ThemeProvider uses this to know which keys
 * to exclude from its own inline root.style.setProperty loop entirely --
 * an inline value always beats a stylesheet rule regardless of @media,
 * so a key left in both places would make its @media rules dead code.
 * @barrelExport
 */
export function getResponsiveVariableKeys(input: ResponsiveThemeInput): Set<string> {
  const keys = new Set<string>();
  if (input.padding) Object.keys(getPaddingVariables(input.padding.base)).forEach(k => keys.add(k));
  if (input.margin) Object.keys(getMarginVariables(input.margin.base)).forEach(k => keys.add(k));
  if (input.radius) Object.keys(getRadiusVariables(input.radius.base)).forEach(k => keys.add(k));
  return keys;
}

/**
 * Renders `input` into real CSS text: one unconditional `:root {}` block
 * for the `base` tier of every configured family, followed by one
 * `@media (min-width: ...) { :root {} }` block per breakpoint that has
 * at least one family setting a value for it. A tier only emits the
 * specific variables a family actually configured for it -- not every
 * variable that family owns -- so an unset tier for one family correctly
 * keeps inheriting whatever the next-narrower matching rule already
 * established for it, exactly the "mobile-first override" behavior
 * min-width media queries give for free via normal cascade rules.
 * @barrelExport
 */
export function generateResponsiveCSS(input: ResponsiveThemeInput): string {
  const blocks: string[] = [];

  const baseVars: Record<string, string> = {
    ...(input.padding ? getPaddingVariables(input.padding.base) : {}),
    ...(input.margin ? getMarginVariables(input.margin.base) : {}),
    ...(input.radius ? getRadiusVariables(input.radius.base) : {}),
  };
  if (Object.keys(baseVars).length > 0) {
    blocks.push(`:root {\n${formatDeclarations(baseVars, '  ')}\n}`);
  }

  for (const bp of BREAKPOINT_ORDER) {
    const tierVars: Record<string, string> = {
      ...(input.padding?.[bp] ? getPaddingVariables(input.padding[bp]) : {}),
      ...(input.margin?.[bp] ? getMarginVariables(input.margin[bp]) : {}),
      ...(input.radius?.[bp] ? getRadiusVariables(input.radius[bp]) : {}),
    };
    if (Object.keys(tierVars).length > 0) {
      blocks.push(`@media (min-width: ${BREAKPOINTS[bp]}px) {\n  :root {\n${formatDeclarations(tierVars, '    ')}\n  }\n}`);
    }
  }

  return blocks.join('\n\n');
}
