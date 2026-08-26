import { injectGlobalStyle } from './injectGlobalStyle';

const STYLE_ID = 'toolcrib-shared-keyframes';

/**
 * The shared entrance/exit `@keyframes` referenced by `animation:` on
 * `Modal`/`AlertDialog`/`Popup`/`Drawer`/`TabStrip.Panel`/`Accordion`
 * (its `'scale-fade'` panel-animation preset) — these used to
 * live only in the demo app's own `index.css`, which worked for the demo
 * but meant any other consumer got components with those `animation:`
 * properties pointing at keyframes that didn't exist anywhere, so no
 * entrance/exit animation ever played, silently (an `animation-name` with
 * no matching `@keyframes` isn't an error, it's just a no-op).
 *
 * Also holds `ai-skeleton-shimmer`/`ai-spin` — `Skeleton`/`Spinner`'s
 * continuous ambient loading animations. A different category from the
 * entrance/exit set above (they never enter/exit, just loop for as long as
 * they're mounted) and deliberately not tied to the `--ai-transition-*`
 * scale from `theme/animation.ts`: that scale is tuned for 100–500ms
 * discrete state-transitions, not a slow, continuous shimmer/spin loop —
 * reusing it here would just make the loop uncomfortably fast, not save a
 * real duplicate token family.
 *
 * `ThemeProvider` calls this on mount, passing its own `targetDocument`
 * and `nonce` — that call is the sole injection point. There used to also
 * be an eager, no-args call at the bottom of this module (running the
 * instant the module was first imported, before any `ThemeProvider` could
 * mount) so the keyframes existed even with zero `ThemeProvider`
 * involvement — but `injectGlobalStyle`'s create-once-per-id dedup meant
 * that eager call always won the race against `ThemeProvider`'s own
 * nonce-aware one for the default document, so a real nonce-based CSP
 * could never actually reach this tag: the un-nonced eager copy had
 * already claimed the id. Removed once it was confirmed (via a real
 * strict-CSP e2e run — see `e2e/csp-nonce.spec.ts`) that this was the
 * literal cause of a genuine, browser-enforced CSP violation, not just a
 * theoretical gap. `ThemeProvider` is already a required root wrapper for
 * every other part of toolcrib's styling (CSS variables, typography, ...),
 * so relying on it here too doesn't lose real coverage — nothing in this
 * codebase renders `Modal`/`Drawer`/etc. without one.
 * @barrelExport
 */
export function injectSharedAnimationKeyframes(targetDocument?: Document, nonce?: string): void {
  injectGlobalStyle(
    STYLE_ID,
    `
    @keyframes ai-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes ai-fade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes ai-scale-in {
      from { opacity: 0; transform: scale(0.92); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes ai-scale-out {
      from { opacity: 1; transform: scale(1); }
      to { opacity: 0; transform: scale(0.92); }
    }
    @keyframes ai-slide-in-right {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }
    @keyframes ai-slide-out-right {
      from { transform: translateX(0); }
      to { transform: translateX(100%); }
    }
    @keyframes ai-slide-in-left {
      from { transform: translateX(-100%); }
      to { transform: translateX(0); }
    }
    @keyframes ai-slide-out-left {
      from { transform: translateX(0); }
      to { transform: translateX(-100%); }
    }
    @keyframes ai-slide-in-top {
      from { transform: translateY(-100%); }
      to { transform: translateY(0); }
    }
    @keyframes ai-slide-out-top {
      from { transform: translateY(0); }
      to { transform: translateY(-100%); }
    }
    @keyframes ai-slide-in-bottom {
      from { transform: translateY(100%); }
      to { transform: translateY(0); }
    }
    @keyframes ai-slide-out-bottom {
      from { transform: translateY(0); }
      to { transform: translateY(100%); }
    }
    @keyframes ai-skeleton-shimmer {
      from { background-position: 100% 50%; }
      to { background-position: 0% 50%; }
    }
    @keyframes ai-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    `,
    targetDocument,
    nonce
  );
}
