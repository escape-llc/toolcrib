import { injectGlobalStyle } from './injectGlobalStyle';

/** @barrelExport */
export const TOOLCRIB_SHARED_KEYFRAMES_STYLE_ID = 'toolcrib-shared-keyframes';

/**
 * The shared entrance/exit `@keyframes` text, referenced by `animation:` on
 * `Modal`/`AlertDialog`/`Popup`/`Drawer`/`TabStrip.Panel`/`Accordion` (its
 * `'scale-fade'` panel-animation preset), plus `ai-skeleton-shimmer`/
 * `ai-spin` for `Skeleton`/`Spinner`'s continuous ambient loading
 * animations — a different category from the entrance/exit set (they
 * never enter/exit, just loop for as long as they're mounted) and
 * deliberately not tied to the `--ai-transition-*` scale from
 * `theme/animation.ts`, which is tuned for 100–500ms discrete
 * state-transitions, not a slow continuous loop. `ai-color-breathe`/
 * `ai-glow-pulse` are a third category, alongside the loading loops above:
 * a continuous, opt-in *decorative* loop (not tied to a loading state),
 * consumed via the `.ai-living-accent`/`.ai-living-glow` marker classes
 * (`livingColorStyles.ts`) and driven by their own `--ai-living-color-*`
 * variables (`livingColor.tsx`) — same reasoning as the loading loops for
 * not reusing `--ai-transition-*`. Exported as a named
 * constant (rather than inlined only in `injectSharedAnimationKeyframes`
 * below) so `computeServerThemeCSS` (`themeContext.tsx`) can return the
 * exact same CSS text for SSR rendering, with no second copy to drift.
 * @barrelExport
 */
export const TOOLCRIB_SHARED_KEYFRAMES_CSS = `
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
    @keyframes ai-color-breathe {
      0%, 100% { background-color: var(--ai-color-primary); }
      50% { background-color: var(--ai-color-secondary); }
    }
    @keyframes ai-glow-pulse {
      0%, 100% { box-shadow: 0 0 0 0 var(--ai-color-primary); }
      50% { box-shadow: 0 0 1.5rem 0.25rem var(--ai-color-secondary); }
    }
    `;

/**
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
 */
export function injectSharedAnimationKeyframes(targetDocument?: Document, nonce?: string): void {
  injectGlobalStyle(TOOLCRIB_SHARED_KEYFRAMES_STYLE_ID, TOOLCRIB_SHARED_KEYFRAMES_CSS, targetDocument, nonce);
}
