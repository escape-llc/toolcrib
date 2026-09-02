import { injectGlobalStyle } from './injectGlobalStyle';

const STYLE_ID = 'toolcrib-living-color-styles';

/**
 * Opt-in ambient decorative loop — two shared marker classes running the
 * shared `ai-color-breathe`/`ai-glow-pulse` keyframes (animationKeyframes.ts),
 * driven by this feature's own `--ai-living-color-*` variables (livingColor.tsx).
 *
 * Deliberately opt-in per element (a component/consumer adds the class
 * itself), unlike TOOLCRIB_THEME_TRANSITIONS_CSS's ambient `:where(*)` rule
 * (themeContext.tsx) — every element on the page breathing color at once
 * would be visual chaos, not a hallmark. A running `animation` on
 * background-color/box-shadow takes CSS-cascade precedence over that
 * transition rule on the same property on the same element, so the two
 * don't fight (verified directly in e2e/living-color.spec.ts, not just
 * assumed from the spec).
 *
 * Includes its own `prefers-reduced-motion: reduce` guard — deliberately
 * doing better than the one existing continuous-loop precedent in this
 * codebase (Skeleton's shimmer, Spinner's spin), which is explicitly
 * exempted from `prefers-reduced-motion`/the `reducedMotion` slice
 * entirely (see animationKeyframes.ts's own doc comment on why). This is
 * the first continuous loop in this codebase to respect the real OS-level
 * signal directly.
 */
export const TOOLCRIB_LIVING_COLOR_CSS = `
.ai-living-accent {
  animation: ai-color-breathe var(--ai-living-color-duration, 6s) var(--ai-living-color-easing, ease-in-out) infinite;
}
.ai-living-glow {
  animation: ai-glow-pulse var(--ai-living-color-duration, 6s) var(--ai-living-color-easing, ease-in-out) infinite;
}
@media (prefers-reduced-motion: reduce) {
  .ai-living-accent,
  .ai-living-glow {
    animation: none !important;
  }
}
`;

/** @barrelExport */
export function injectLivingColorStyles(targetDocument?: Document, nonce?: string): void {
  injectGlobalStyle(STYLE_ID, TOOLCRIB_LIVING_COLOR_CSS, targetDocument, nonce);
}

export const TOOLCRIB_LIVING_COLOR_STYLE_ID = STYLE_ID;
