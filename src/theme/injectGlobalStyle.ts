/**
 * Injects a `<style>` tag into `targetDocument.head` (the global `document`
 * by default) exactly once per `id` — the mechanism this toolkit uses for
 * real CSS rules (`:hover`, `:first-child`, `color-mix()`, ...) that an
 * inline `style` object can't express. Safe to call on every render/mount:
 * the `getElementById` guard makes repeat calls (multiple instances of the
 * same component, StrictMode double-invoke) no-ops after the first.
 *
 * The optional `targetDocument` matches `ThemeProvider`'s own
 * `targetDocument` prop (see themeContext.tsx) — a component portaled into
 * a different document (e.g. an `<iframe>`'s own, via
 * `ReactDOM.createPortal`) needs its self-injected CSS in *that*
 * document's `<head>`, not the outer page's, or the rule simply never
 * reaches it. `id` uniqueness is naturally scoped per-document (two
 * different documents can each have their own element with the same id),
 * so injecting the same `id` into two different documents is not a
 * collision — each gets its own copy, exactly as intended.
 */
export function injectGlobalStyle(id: string, css: string, targetDocument?: Document): void {
  const doc = targetDocument ?? (typeof document === 'undefined' ? undefined : document);
  if (!doc) return;
  if (doc.getElementById(id)) return;
  const styleEl = doc.createElement('style');
  styleEl.id = id;
  styleEl.textContent = css;
  doc.head.appendChild(styleEl);
}
