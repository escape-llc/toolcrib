'use client';

import React from 'react';
import { type StyleFreeAttributes } from '../../theme/safeProps';
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
 * Props for the `<Block>` themed surface.
 *
 * Like every toolcrib component, `<Block>` takes no `style`/`className`
 * (`ai-docs/CORE.md`'s Core Principles, principle 7). It used to be the one
 * exception -- a "stylable div" for ad-hoc layout -- until the maintainer
 * confirmed the rule has none (#647); no call site used it. Its job is a
 * themed surface: background, padding, radius, border and subtheme, each
 * resolved from theme tokens, so an area doesn't need hand-typed
 * `var(--ai-…)` strings (or worse, literal hex/px) to look right. Layout
 * (direction, alignment, gaps) belongs to `<VStack>`/`<HStack>`/`<Grid>`.
 * Stay in theme as hard as possible (CORE.md principle 7's ladder:
 * props, `overrides`, style domains, themed primitives like this one, a
 * theme-level change). A raw styled `<div>`/`<span>` is the last resort:
 * its `style` still reads the theme's CSS variables, never literal hex/px,
 * with a short comment saying why nothing above covered it.
 */
export interface BlockProps extends StyleFreeAttributes<HTMLDivElement> {
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
  /**
   * Status edge: a thick (0.25rem) inline-start border in the subtheme's border colour, for callouts. Ignored unless a subtheme resolves. Works with or without `border`; with it, the other sides stay hairline.
   * @default false
   */
  edge?: boolean;
  /** Apply a subtheme colour to background/border/text. Falls back to the nearest `<StyleDomainProvider>`'s if omitted. Wins over `background` when resolved; only colors the border if `border` is also set. */
  subtheme?: SubthemeName;
  /** Visual treatment for `subtheme`'s color. Ignored unless a subtheme resolves. @default 'soft' */
  appearance?: Appearance;
}

const BORDER_HAIRLINE = '0.0625rem';
const BORDER_EDGE = '0.25rem';

const BACKGROUND_VAR: Record<BlockBackground, string> = {
  surface: 'var(--ai-bg-surface, #ffffff)',
  container: 'var(--ai-bg-container, #f3f4f6)',
  primary: 'var(--ai-bg-primary, #ffffff)',
  transparent: 'transparent',
};

/**
 * @manifest Themed surface `<div>`: background, padding, radius, border and subtheme colouring, all from theme tokens — no style/className, like every toolcrib component
 * @manifestConstraints Not a layout tool: use VStack/HStack/Grid for direction, alignment and gaps. Stay in theme first (props, overrides, StyleDomainProvider, theme-level changes); a raw styled div/span is the last resort, and its style still uses var(--ai-*) theme variables, never literal hex/px
 * @manifestCategory Layout Primitives
 */
export const Block: React.FC<BlockProps> = ({
  background = 'transparent',
  padding = 'none',
  paddingMode,
  radius = 'none',
  cornerRadiusMode,
  border = false,
  edge = false,
  subtheme: instanceSubtheme,
  appearance = 'soft',
  children,
  ...props
}) => {
  const subtheme = useResolvedSubtheme(instanceSubtheme);
  const subthemeColors = subtheme ? resolveColorVariant({ subtheme, appearance }) : null;
  // `edge` is ignored without a resolved subtheme, same rule as the subtheme
  // colouring of `border`.
  const edgeActive = edge && subthemeColors !== null;
  const borderColor = subthemeColors?.border ?? 'var(--ai-border, #e5e7eb)';
  // Longhands only, never the `border` shorthand: toggling `edge`/`border`
  // across renders must not mix a shorthand with a sometimes-present
  // longhand (React warns "Removing a style property during rerender").
  const borderStyles: React.CSSProperties =
    border || edgeActive
      ? {
          borderTopWidth: border ? BORDER_HAIRLINE : 0,
          borderBottomWidth: border ? BORDER_HAIRLINE : 0,
          borderInlineEndWidth: border ? BORDER_HAIRLINE : 0,
          borderInlineStartWidth: edgeActive ? BORDER_EDGE : border ? BORDER_HAIRLINE : 0,
          borderTopStyle: 'solid',
          borderBottomStyle: 'solid',
          borderInlineEndStyle: 'solid',
          borderInlineStartStyle: 'solid',
          borderTopColor: borderColor,
          borderBottomColor: borderColor,
          borderInlineEndColor: borderColor,
          borderInlineStartColor: borderColor,
        }
      : {};

  return (
    <div
      {...props}
      style={{
        boxSizing: 'border-box',
        background: subthemeColors?.background ?? BACKGROUND_VAR[background],
        color: subthemeColors?.color ?? 'var(--ai-text-primary, #111827)',
        ...(padding !== 'none' ? { padding: resolvePadding(paddingMode, padding) } : {}),
        ...(radius !== 'none' ? { borderRadius: resolveRadius(cornerRadiusMode, radius) } : {}),
        ...borderStyles,
      }}
    >
      {children}
    </div>
  );
};
