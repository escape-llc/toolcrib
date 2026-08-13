/**
 * Injects a `<style>` tag into `document.head` exactly once per `id` — the
 * mechanism this toolkit uses for real CSS rules (`:hover`, `:first-child`,
 * `color-mix()`, ...) that an inline `style` object can't express. Safe to
 * call on every render/mount: the `document.getElementById` guard makes
 * repeat calls (multiple instances of the same component, StrictMode
 * double-invoke) no-ops after the first.
 */
export function injectGlobalStyle(id: string, css: string): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(id)) return;
  const styleEl = document.createElement('style');
  styleEl.id = id;
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}
