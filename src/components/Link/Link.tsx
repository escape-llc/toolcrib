'use client';

import React, { type AnchorHTMLAttributes, type CSSProperties } from 'react';
import { type StyleFree } from '../../theme/safeProps';
import { useResolvedSubtheme } from '../../theme/useSliceOverrides';
import { useInjectInteractionStyles } from '../../theme/interactionStyles';
import { resolveSubtheme, type SubthemeName } from '../../theme/subtheme';
import { type ColorVariant } from '../../theme/colorVariant';

/** Props for the `<Link>` hyperlink. */
export interface LinkProps extends StyleFree<AnchorHTMLAttributes<HTMLAnchorElement>> {
  /**
   * Identity color from the harmony palette, used for both the unvisited
   * and (nudged) visited text color — matches whichever brand hue `variant`
   * on `<Button>`/`<Badge>` already resolves to, so a link reads as part of
   * the same themed surface rather than a fixed, independent color.
   * Ignored if `subtheme` is set. @default 'primary'
   */
  variant?: ColorVariant;
  /**
   * Apply a subtheme colour instead (e.g. a destructive "Delete account"
   * link). Wins over `variant` if both are set. Unlike `variant`, uses the
   * same resolved color for both unvisited and visited state — a status
   * colored link's meaning doesn't change once visited the way an ordinary
   * navigational link's does.
   */
  subtheme?: SubthemeName;
}

const VARIANT_LINK_VARS: Record<ColorVariant, CSSProperties> = {
  // 'primary' matches TOOLCRIB_LINK_CSS's own fallback chain exactly, so no
  // override is needed for the common case — this entry exists only for
  // completeness/symmetry with 'secondary' below.
  primary: {},
  secondary: {
    '--ai-link-color': 'var(--ai-color-secondary-readable)',
    '--ai-link-visited-color': 'var(--ai-color-primary-readable)',
  } as CSSProperties,
};

/**
 * @manifest Themed hyperlink — colors itself from the theme's identity palette (hue-preserving, WCAG AA against the page background) for both unvisited and `:visited` state, and auto-applies `rel="noopener noreferrer"` when `target="_blank"`
 * @manifestCategory Data Display
 * @manifestAntiPatternAvoid Hardcode a link's color (or leave it unthemed), or write `<a target="_blank">` without also setting `rel="noopener noreferrer"` (reverse-tabnabbing — the opened page gets `window.opener` and can navigate your tab)
 * @manifestAntiPatternInstead Use `<Link>` — colors itself from `--ai-color-primary-readable`/`-secondary-readable` (hue preserved, contrast-checked) for link/visited state, and supplies the safe `rel` default automatically
 */
export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ variant = 'primary', subtheme: instanceSubtheme, target, rel, children, ...props }, ref) => {
    const subtheme = useResolvedSubtheme(instanceSubtheme);
    useInjectInteractionStyles();

    const subthemeColors = subtheme ? resolveSubtheme(subtheme) : undefined;
    const colorVars: CSSProperties = subthemeColors
      ? ({ '--ai-link-color': subthemeColors.color, '--ai-link-visited-color': subthemeColors.color } as CSSProperties)
      : VARIANT_LINK_VARS[variant];

    // target="_blank" without an explicit rel leaves window.opener reachable
    // from the opened page — a real reverse-tabnabbing risk, not just a
    // lint nicety. Only supplied when the consumer hasn't set their own
    // rel at all; an explicit rel (including one that omits noopener on
    // purpose) is left alone.
    const resolvedRel = target === '_blank' && rel === undefined ? 'noopener noreferrer' : rel;

    return (
      <a {...props} ref={ref} target={target} rel={resolvedRel} className="ai-focus-ring ai-link" style={colorVars}>
        {children}
      </a>
    );
  }
);
Link.displayName = 'Link';
