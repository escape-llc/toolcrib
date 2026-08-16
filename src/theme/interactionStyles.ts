import { useEffect } from 'react';
import { injectGlobalStyle } from './injectGlobalStyle';
import { useTargetDocument } from './targetDocumentContext';

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
 * Two more classes extend the same systematic treatment to controls that
 * don't fit the "button with a hover-tintable background" shape:
 *
 * - `.ai-focus-ring` — just the `:focus-visible` ring, for custom-shaped
 *   native controls with no hover-tint model of their own (the Select
 *   trigger, RadioGroup's dot, Checkbox, Switch). Same accessibility gap as
 *   above: all four previously reset `outline` to nothing (via an explicit
 *   `outline: 'none'` or `all: 'unset'`) with no replacement.
 * - `.ai-menu-item[data-highlighted]` — for Radix menu-style items
 *   (DropdownMenu.Item, ContextMenu.Item, Select.Item). Radix's own
 *   `data-highlighted` attribute already unifies mouse-hover and keyboard
 *   navigation into one signal (correctly, regardless of whether a given
 *   Radix primitive happens to move real DOM focus per item or not) — using
 *   it instead of separate `:hover`/`:focus-visible` rules means one rule
 *   covers both input modalities exactly the way Radix itself considers
 *   "this item is the current candidate", rather than approximating it.
 *
 * `!important` is only used where a component's own inline `style` already
 * sets that exact property (documented per-rule below) — inline style
 * always outranks an external stylesheet rule otherwise, override or not.
 */
export function injectInteractionStyles(targetDocument?: Document): void {
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

    /* :focus-visible — !important unconditionally: some .ai-btn consumers
       (e.g. Collapsible's trigger, via \`all: 'unset'\`) reset outline inline
       same as an explicit \`outline: 'none'\` would, and there's no
       legitimate case where a .ai-btn user wants its own focus ring
       suppressed, so this doesn't need tracking per-consumer like :hover's
       --ai-btn-bg does. */
    .ai-btn:focus-visible {
      outline: var(--ai-focus-ring-width, 0.125rem) solid var(--ai-focus-ring, #3b82f6) !important;
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

    /* .ai-focus-ring — every current user (Select's trigger, RadioGroup's
       dot, Checkbox, Switch) sets an inline \`outline: 'none'\` (or resets it
       via \`all: 'unset'\`, same effective result), so this needs !important
       on every one of them to actually win. */
    .ai-focus-ring:focus-visible {
      outline: var(--ai-focus-ring-width, 0.125rem) solid var(--ai-focus-ring, #3b82f6) !important;
      outline-offset: var(--ai-focus-ring-offset, 0.125rem);
    }

    /* .ai-menu-item — none of DropdownMenu.Item/ContextMenu.Item/Select.Item
       set an inline \`background\` at all (implicitly transparent), so no
       !important is needed to tint one in. */
    .ai-menu-item[data-highlighted] {
      background: color-mix(in srgb, currentColor var(--ai-menu-item-highlight-amount, 10%), transparent);
    }
    `,
    targetDocument
  );
}

/**
 * Convenience hook wrapping the `useTargetDocument()` + `useEffect(() =>
 * injectInteractionStyles(targetDocument), [targetDocument])` triad every
 * `.ai-btn`/`.ai-focus-ring`/`.ai-menu-item` consumer needs — found
 * hand-copied at ~20 separate call sites across the component tree by an
 * external review pass; collapses each to a single `useInjectInteractionStyles();`
 * call instead.
 */
export function useInjectInteractionStyles(): void {
  const targetDocument = useTargetDocument();
  useEffect(() => {
    injectInteractionStyles(targetDocument);
  }, [targetDocument]);
}
