import { injectGlobalStyle } from './injectGlobalStyle';

const STYLE_ID = 'toolcrib-interaction-styles';

/**
 * Shared user-interaction treatment for every plain "button-like" element in
 * the toolkit — opted into via the `.ai-btn` className (`<Button>`,
 * TabStrip's filmstrip scroll arrows, TabStrip's legacy `.Tab`) and
 * `.ai-tab-trigger` (TabStrip's Radix `Tabs.Trigger`). Covers three
 * interaction pseudo-classes systematically, not just `:hover`:
 *
 * - `:hover` — a live `color-mix()` background tint (see this file's
 *   previous incarnation as hoverStyles.ts). Never computed in JS.
 * - `:focus-visible` — a visible ring using the already-generated
 *   `--ai-focus-ring` palette colour. Before this, every interactive
 *   component in the toolkit set `outline: 'none'` unconditionally with
 *   nothing to replace it — a real keyboard-accessibility gap (WCAG 2.4.7),
 *   not just a missing nicety: a keyboard user tabbing to a `<Button>` saw
 *   no focus indicator at all. `:focus-visible` (not `:focus`) so a mouse
 *   click doesn't also draw the ring, matching native browser behaviour.
 * - `:active` — a brief press-down feel using the animation slice's own
 *   `--ai-active-transform` token (already computed by animation.ts, was
 *   sitting unused until now), so it automatically respects the same
 *   Motion/Physics preset and `reducedMotion` setting as everything else.
 *
 * `!important` is only used where a component's own inline `style` already
 * sets that exact property (documented per-rule below) — inline style
 * always outranks an external stylesheet rule otherwise, override or not.
 */
export function injectInteractionStyles(): void {
  injectGlobalStyle(
    STYLE_ID,
    `
    /* :hover — !important because every .ai-btn/.ai-tab-trigger instance
       sets its own inline \`background\` for its normal appearance. */
    .ai-btn:hover:not(:disabled) {
      background: color-mix(in srgb, currentColor var(--ai-button-hover-amount, 12%), var(--ai-btn-bg, transparent)) !important;
    }
    .ai-tab-trigger:hover:not(:disabled) {
      background: color-mix(in srgb, currentColor var(--ai-tab-hover-amount, 12%), var(--ai-tab-bg, transparent)) !important;
    }

    /* :focus-visible — <Button> doesn't set an inline \`outline\`, so no
       !important needed there; TabStrip's Trigger does (\`outline: 'none'\`),
       so its rule needs one to actually win. */
    .ai-btn:focus-visible {
      outline: var(--ai-focus-ring-width, 0.125rem) solid var(--ai-focus-ring, #3b82f6);
      outline-offset: var(--ai-focus-ring-offset, 0.125rem);
    }
    .ai-tab-trigger:focus-visible {
      outline: var(--ai-focus-ring-width, 0.125rem) solid var(--ai-focus-ring, #3b82f6) !important;
      outline-offset: var(--ai-focus-ring-offset, 0.125rem);
    }

    /* :active — neither element sets an inline \`transform\`, so no
       !important needed for either rule. */
    .ai-btn:active:not(:disabled) {
      transform: var(--ai-active-transform, scale(0.98));
    }
    .ai-tab-trigger:active:not(:disabled) {
      transform: var(--ai-active-transform, scale(0.98));
    }
    `
  );
}
