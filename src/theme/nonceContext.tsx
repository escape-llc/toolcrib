'use client';

import { createContext, useContext } from 'react';

/** @barrelExport */
export const NonceContext = createContext<string | undefined>(undefined);

/**
 * Reads the Content-Security-Policy nonce every component's own
 * self-injected CSS (`injectGlobalStyle`/`injectInteractionStyles`/
 * `injectToastAnimations`/`injectAccordionStyles`/
 * `injectCornerSquaringStyles`, ...) should set on the `<style>` tag it
 * creates. Set by the nearest ancestor `<ThemeProvider nonce>`; `undefined`
 * (the default, outside any provider or when that prop is omitted) means
 * "no nonce" -- fine for the common case (a permissive or `'unsafe-inline'`
 * `style-src`), required for a strict, nonce-based one (see CORE.md's CSP
 * note).
 *
 * A separate context from `TargetDocumentContext`, not a field added onto
 * it, mirroring how `StyleDomainContext`/`LayoutDomainContext` already
 * stay as separate, parallel contexts for genuinely different axes rather
 * than one combined one -- `targetDocument` and `nonce` are independent
 * concerns (a portaled iframe's document vs. a security policy value) that
 * happen to both flow into the same class of call (`injectGlobalStyle`),
 * not one concept that grew a second field.
 */
export function useNonce(): string | undefined {
  return useContext(NonceContext);
}
