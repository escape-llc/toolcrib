import { injectGlobalStyle } from './injectGlobalStyle';

const STYLE_ID = 'toolcrib-shared-keyframes';

/**
 * The shared entrance/exit `@keyframes` referenced by `animation:` on
 * `Modal`/`AlertDialog`/`Popup`/`Drawer`/`TabStrip.Panel` — these used to
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
 * Called once, unconditionally, at the bottom of this module — not lazily
 * per-component like `injectInteractionStyles`/`injectToastAnimations`,
 * and deliberately not from `src/index.ts` either, even though that's the
 * package barrel: `src/index.ts` is itself generated in full by
 * `scripts/generate-index.js` from every file's `@manifest`/`@barrelExport`
 * tags, so anything hand-added directly there gets silently wiped the next
 * time it's regenerated. This function's own `@barrelExport` tag below is
 * what makes the generator emit `export * from './theme/animationKeyframes'`
 * — importing *anything* from the package re-exports this module, which
 * evaluates its own body (including the no-args call at the bottom)
 * exactly once, so the keyframes are guaranteed to exist in the global
 * `document` without any consumer or future component author needing to
 * remember to wire this up themselves.
 *
 * That module-load-time call can't know about a `targetDocument` (nothing
 * has rendered yet), so it always targets the global `document` — correct
 * for the overwhelmingly common case. `ThemeProvider` separately calls
 * this again, explicitly passing its own `targetDocument`, so the one case
 * that first call can't cover (a `<ThemeProvider targetDocument>` portaled
 * into a different document, e.g. an `<iframe>`'s own) still gets its own
 * copy — see `themeContext.tsx`'s own call for why that's not a redundant
 * duplicate for the common case (it's a no-op there, guarded the same way
 * every `injectGlobalStyle` call is).
 * @barrelExport
 */
export function injectSharedAnimationKeyframes(targetDocument?: Document): void {
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
    targetDocument
  );
}

// Runs once, the moment this module is first evaluated — see the doc
// comment above for why this lives here instead of in src/index.ts.
injectSharedAnimationKeyframes();
