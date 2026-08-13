import { injectGlobalStyle } from './injectGlobalStyle';

const STYLE_ID = 'toolcrib-hover-styles';

/**
 * Shared hover treatment for every plain "button-like" element in the
 * toolkit — opted into via the `.ai-btn` className (`<Button>`, TabStrip's
 * filmstrip scroll arrows, TabStrip's legacy `.Tab`) and `.ai-tab-trigger`
 * (TabStrip's Radix `Tabs.Trigger`).
 *
 * The hover colour is never computed in JS: each element sets its own
 * `--ai-btn-bg`/`--ai-tab-bg` custom property to whatever its *normal*
 * background already resolves to, and this single `color-mix()` rule tints
 * that live, in CSS, toward the element's own `currentColor` — so it stays
 * correct automatically for every variant/subtheme/light-or-dark-mode
 * combination without this file (or any component) ever knowing what the
 * actual resulting colour is.
 */
export function injectHoverStyles(): void {
  injectGlobalStyle(
    STYLE_ID,
    `
    .ai-btn:hover:not(:disabled) {
      /* !important: every one of these elements sets its own \`background\`
         via inline style (its normal, non-hover appearance), which always
         outranks an external stylesheet rule regardless of specificity or
         :hover — same reason UIGroup's own injected stylesheet needs it for
         border-radius. */
      background: color-mix(in srgb, currentColor var(--ai-button-hover-amount, 12%), var(--ai-btn-bg, transparent)) !important;
    }
    .ai-tab-trigger:hover:not(:disabled) {
      background: color-mix(in srgb, currentColor var(--ai-tab-hover-amount, 12%), var(--ai-tab-bg, transparent)) !important;
    }
    `
  );
}
