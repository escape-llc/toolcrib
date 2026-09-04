'use client';

import { useEffect } from 'react';
import { injectGlobalStyle } from './injectGlobalStyle';
import { useTargetDocument } from './targetDocumentContext';
import { useNonce } from './nonceContext';

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
 *   The ring now *fades* in/out (`outline-color` transition) instead of
 *   snapping — see the base rule's own comment below for why that requires
 *   `outline-style` to be permanently `solid` rather than toggling with
 *   `:focus-visible` itself.
 * - `:active` — a brief press-down feel using the animation slice's own
 *   `--ai-active-transform` token (already computed by animation.ts, was
 *   sitting unused until now), so it automatically respects the same
 *   Motion/Physics preset and `reducedMotion` setting as everything else.
 *
 * One more class extends the same systematic treatment to controls that
 * don't fit the "button with a hover-tintable background" shape:
 *
 * - `.ai-focus-ring` — the `:focus-visible` ring, for custom-shaped native
 *   controls with no hover-tint model of their own (the Select trigger,
 *   RadioGroup's dot, Checkbox, Switch) *and* for a wrapper whose actual
 *   focusable element is a descendant rather than itself (Combobox's own
 *   chip-row anchor around its `<input>`). One class handles both shapes —
 *   `:focus-visible` for "this exact element receives focus" and
 *   `:has(:focus-visible)` for "a descendant does" are combined in the same
 *   rule below, so a component author never has to choose between two
 *   similarly-named classes (`.ai-focus-ring` vs. a `.ai-focus-ring-within`
 *   sibling, the previous shape of this fix) or risk picking the wrong one
 *   — `:focus-visible` alone silently never matches a wrapper that's never
 *   itself the real focus target, which is exactly the bug this used to be
 *   found and fixed one component at a time (see `AGENTS.md`'s own history
 *   of it). `:has(:focus-visible)`, not the broader `:focus-within`,
 *   deliberately — `:focus-within` matches on *any* focus, including a
 *   plain mouse click on the descendant, which would reintroduce exactly
 *   the "ring shows for a mouse user" problem `:focus-visible` exists
 *   everywhere else in this file to avoid.
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
export function injectInteractionStyles(targetDocument?: Document, nonce?: string): void {
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

    /* :focus-visible base + focus state — !important unconditionally: some
       .ai-btn consumers (e.g. Collapsible's trigger, via \`all: 'unset'\`)
       reset outline inline same as an explicit \`outline: 'none'\` would,
       and there's no legitimate case where a .ai-btn user wants its own
       focus ring suppressed, so this doesn't need tracking per-consumer
       like :hover's --ai-btn-bg does.

       The base rule declares outline-style: solid (via the outline
       shorthand) UNCONDITIONALLY, with a transparent colour -- only
       outline-color itself changes on focus, transitioned smoothly.
       outline-style is a discrete keyword (can't interpolate a value
       between 'none' and 'solid'), so a version that only sets \`outline\`
       at :focus-visible -- leaving no outline at all beforehand -- makes
       outline-style itself flip abruptly the instant :focus-visible
       matches, and no transition on outline-color can smooth that over:
       there's nothing rendered to fade from. Keeping outline-style
       constantly 'solid' and only transitioning its colour is the
       standard fix. Reuses the animation slice's own
       --ai-transition-duration-normal/--ai-transition-easing -- NOT
       -duration-fast, and confirmed why the hard way: sampled the real
       fade curve live at the fast tier's default 120ms and it had already
       fully interpolated to the ring colour by ~121ms, yet was reported as
       imperceptible. animation.tsx's getAnimationVariables() now floors
       every duration tier at a minimum perceptible value for exactly this
       reason (a transition too fast to consciously register is
       functionally identical to no transition), but -normal is still the
       better *choice* of tier here even with that floor in place --
       -fast's whole unfloored range sits at the low end of what a human
       can register at all, so reaching for it for something that must
       always visibly announce itself (a focus indicator, not a hover
       micro-interaction) was the wrong tier regardless of the floor. */
    .ai-btn,
    .ai-tab-trigger,
    .ai-focus-ring {
      outline: var(--ai-focus-ring-width, 0.125rem) solid transparent !important;
      outline-offset: var(--ai-focus-ring-offset, 0.125rem);
      transition: outline-color var(--ai-transition-duration-normal, 0.2s) var(--ai-transition-easing, ease) !important;
    }
    .ai-btn:focus-visible,
    .ai-tab-trigger:focus-visible,
    .ai-focus-ring:focus-visible,
    .ai-focus-ring:has(:focus-visible) {
      outline-color: var(--ai-focus-ring, #3b82f6) !important;
    }

    /* :active — neither element sets an inline \`transform\`, so no
       !important needed for either rule. */
    .ai-btn:active:not(:disabled) {
      transform: var(--ai-active-transform, scale(0.98));
    }
    .ai-tab-trigger:active:not(:disabled) {
      transform: var(--ai-active-transform, scale(0.98));
    }

    /* .ai-menu-item — none of DropdownMenu.Item/ContextMenu.Item/Select.Item
       set an inline \`background\` at all (implicitly transparent), so no
       !important is needed to tint one in. */
    .ai-menu-item[data-highlighted] {
      background: color-mix(in srgb, currentColor var(--ai-menu-item-highlight-amount, 10%), transparent);
    }
    `,
    targetDocument,
    nonce
  );
}

/**
 * Convenience hook wrapping the `useTargetDocument()` + `useEffect(() =>
 * injectInteractionStyles(targetDocument), [targetDocument])` triad every
 * `.ai-btn`/`.ai-focus-ring`/`.ai-menu-item` consumer needs — found
 * hand-copied at ~20 separate call sites across the component tree by an
 * external review pass; collapses each to a single `useInjectInteractionStyles();`
 * call instead. Also the one place `nonce` (CORE.md's CSP note) needs
 * wiring for all ~20 of those consumers at once, rather than touching each.
 */
export function useInjectInteractionStyles(): void {
  const targetDocument = useTargetDocument();
  const nonce = useNonce();
  useEffect(() => {
    injectInteractionStyles(targetDocument, nonce);
  }, [targetDocument, nonce]);
}
