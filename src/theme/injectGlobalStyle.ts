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
 *
 * The optional `nonce` matches `ThemeProvider`'s own `nonce` prop — a
 * consumer running a strict, nonce-based Content-Security-Policy
 * (`style-src` with no `'unsafe-inline'`) needs it set on every `<style>`
 * tag this toolkit creates, or the browser drops the rule silently (see
 * CORE.md's own CSP note: this is the one real gap in an otherwise
 * CSP-compatible styling model, since inline `style` *props* go through
 * React's CSSOM-property-assignment path instead, which CSP's
 * `style-src-attr` enforcement doesn't intercept at all). Set via the
 * `.nonce` IDL property, not `setAttribute('nonce', ...)` — the `nonce`
 * *content* attribute is deliberately unreadable/unreliable post-parse in
 * modern browsers for security reasons (prevents leaking it back out via
 * a CSS attribute selector); the IDL property is the only mechanism specs
 * guarantee actually satisfies CSP nonce checking from script.
 */
export function injectGlobalStyle(id: string, css: string, targetDocument?: Document, nonce?: string): void {
  const doc = targetDocument ?? (typeof document === 'undefined' ? undefined : document);
  if (!doc) return;
  if (doc.getElementById(id)) return;
  const styleEl = doc.createElement('style');
  styleEl.id = id;
  if (nonce) styleEl.nonce = nonce;
  styleEl.textContent = css;
  doc.head.appendChild(styleEl);
}

/**
 * `injectGlobalStyle`'s sibling for CSS text that can genuinely change
 * over a provider's lifetime (e.g. responsive.ts's generated `@media`
 * blocks, which change whenever a live theme setter like `setPaddingMode`
 * flips a mode between static and responsive) -- `injectGlobalStyle`
 * itself is deliberately create-once/never-update, correct for its
 * existing callers' genuinely static content, but wrong here: update
 * the existing tag's content in place instead of no-op'ing past it.
 * `nonce` only matters on the creation path — an existing element already
 * carries whatever nonce it was created with, and updating `textContent`
 * doesn't re-trigger CSP's nonce check (only insertion does), so there's
 * nothing to re-apply on the update path.
 */
export function upsertGlobalStyle(id: string, css: string, targetDocument?: Document, nonce?: string): void {
  const doc = targetDocument ?? (typeof document === 'undefined' ? undefined : document);
  if (!doc) return;
  const existing = doc.getElementById(id) as HTMLStyleElement | null;
  if (existing) {
    if (existing.textContent !== css) existing.textContent = css;
    return;
  }
  const styleEl = doc.createElement('style');
  styleEl.id = id;
  if (nonce) styleEl.nonce = nonce;
  styleEl.textContent = css;
  doc.head.appendChild(styleEl);
}

/** Removes a tag previously injected by `upsertGlobalStyle` (or `injectGlobalStyle`), if present. */
export function removeGlobalStyle(id: string, targetDocument?: Document): void {
  const doc = targetDocument ?? (typeof document === 'undefined' ? undefined : document);
  doc?.getElementById(id)?.remove();
}
