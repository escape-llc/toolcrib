'use client';

import React, { type HTMLAttributes } from 'react';
import { type PaddingMode, resolvePadding } from '../../theme/padding';
import { type CornerRadiusMode, resolveRadius } from '../../theme/radius';
import { useResolvedSubtheme } from '../../theme/useSliceOverrides';
import { type SubthemeName } from '../../theme/subtheme';
import { resolveColorVariant, type Appearance } from '../../theme/colorVariant';

/** @barrelExport */
export type BlockBackground = 'surface' | 'container' | 'primary' | 'transparent';
/** @barrelExport */
export type BlockPadding = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'none';
/** @barrelExport */
export type BlockRadius = 'sm' | 'md' | 'lg' | 'xl' | 'none';

/**
 * Props for the `<Block>` themed container.
 *
 * The one deliberate exception to "no toolcrib component accepts `style`/
 * `className`" (see `ai-docs/CORE.md` §2 principle 7) — everywhere else
 * that rule holds so every visual decision stays theme-driven and
 * AI-legible, but there's a real, recurring need underneath it: a plain
 * layout wrapper `<div>` for cases no curated component's own props cover
 * (a flex/grid container, a bare spacer, an ad-hoc grouping box). Without
 * `<Block>`, generating one of those means falling back to hand-picked
 * hex colors and pixel values, since a raw `<div>` has no theme awareness
 * of its own. `<Block>`'s own `background`/`padding`/`radius`/`border`
 * props default to the same CSS variables every other component already
 * uses, so reaching for it doesn't mean leaving the theme system — `style`/
 * `className` are still accepted on top, for whatever those curated props
 * genuinely don't cover (layout properties like `display`/`flexDirection`/
 * `gap`, primarily).
 */
export interface BlockProps extends HTMLAttributes<HTMLDivElement> {
  /** Background surface token. @default 'transparent' */
  background?: BlockBackground;
  /** Padding, using the same global padding token scale (`--ai-padding-*`) every other component's own padding resolves through. @default 'none' */
  padding?: BlockPadding;
  /** Per-instance override for which padding density scale `padding` resolves against (compact/normal/spacious) — same `PaddingMode` every other component's own `paddingMode` prop uses. */
  paddingMode?: PaddingMode;
  /** Corner radius, using the same global radius token scale (`--ai-radius-*`) every other component's own radius resolves through. @default 'none' */
  radius?: BlockRadius;
  /** Per-instance override for which radius scale `radius` resolves against (sharp/subtle/rounded/pill) — same `CornerRadiusMode` every other component's own `cornerRadiusMode` prop uses. */
  cornerRadiusMode?: CornerRadiusMode;
  /** Themed hairline border. @default false */
  border?: boolean;
  /** Apply a subtheme colour to background/border/text. Falls back to the nearest `<StyleDomainProvider>`'s if omitted. Wins over `background` when resolved; only colors the border if `border` is also set. */
  subtheme?: SubthemeName;
  /** Visual treatment for `subtheme`'s color. Ignored unless a subtheme resolves. @default 'soft' */
  appearance?: Appearance;
}

const BACKGROUND_VAR: Record<BlockBackground, string> = {
  surface: 'var(--ai-bg-surface, #ffffff)',
  container: 'var(--ai-bg-container, #f3f4f6)',
  primary: 'var(--ai-bg-primary, #ffffff)',
  transparent: 'transparent',
};

/**
 * @manifest Themed, stylable container `<div>` with subtheme colouring — the one deliberate exception to "no style/className on toolcrib components", for ad-hoc layout needs nothing else covers
 * @manifestConstraints Its own background/padding/radius/border props stay theme-driven by default; style/className layer on top rather than replacing them
 * @manifestCategory Layout Primitives
 */
export const Block: React.FC<BlockProps> = ({
  background = 'transparent',
  padding = 'none',
  paddingMode,
  radius = 'none',
  cornerRadiusMode,
  border = false,
  subtheme: instanceSubtheme,
  appearance = 'soft',
  style,
  children,
  ...props
}) => {
  const subtheme = useResolvedSubtheme(instanceSubtheme);
  const subthemeColors = subtheme ? resolveColorVariant({ subtheme, appearance }) : null;

  return (
    <div
      {...props}
      style={{
        boxSizing: 'border-box',
        background: subthemeColors?.background ?? BACKGROUND_VAR[background],
        color: subthemeColors?.color ?? 'var(--ai-text-primary, #111827)',
        ...(padding !== 'none' ? { padding: resolvePadding(paddingMode, padding) } : {}),
        ...(radius !== 'none' ? { borderRadius: resolveRadius(cornerRadiusMode, radius) } : {}),
        ...(border ? { border: `0.0625rem solid ${subthemeColors?.border ?? 'var(--ai-border, #e5e7eb)'}` } : {}),
        // Spread last, deliberately — this is the one component in the
        // toolkit where a consumer's own style is meant to win over the
        // themed defaults above, not the other way around.
        ...style,
      }}
    >
      {children}
    </div>
  );
};
