import { createContext, useContext } from 'react';

/** @barrelExport */
export const TargetDocumentContext = createContext<Document | undefined>(undefined);

/**
 * Reads the `Document` this component's self-injected CSS
 * (`injectGlobalStyle` calls — `injectInteractionStyles`,
 * `injectToastAnimations`, `injectAccordionStyles`,
 * `injectCornerSquaringStyles`, ...) should target. Set by the nearest
 * ancestor `<ThemeProvider targetDocument>`; `undefined` (the default,
 * outside any provider or when that prop is omitted) means "use the
 * global `document`" — matches `injectGlobalStyle`'s own handling of an
 * `undefined` target.
 *
 * Context-based for the same reason `StyleDomainContext` is (see that
 * file's own comment): `Modal`/`Popup`/`Drawer`/`DropdownMenu`/
 * `ContextMenu` all render their real content through a portal, so
 * nothing about a component's position in the *DOM* tree reliably says
 * which `Document` it's actually in — only React Context, which follows
 * the *component* tree regardless of where a portal's output lands, does.
 * Without this, a component rendered inside an iframe-portaled
 * `<ThemeProvider targetDocument={iframeDoc}>` would still inject its
 * hover/focus/animation CSS into the outer page's `<head>` — the palette
 * CSS variables would correctly reach the iframe (`ThemeProvider` writes
 * those directly, no injector involved), but `:hover`/`:focus-visible`/
 * `@keyframes` rules never would, silently.
 */
export function useTargetDocument(): Document | undefined {
  return useContext(TargetDocumentContext);
}
