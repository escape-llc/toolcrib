import React, { createContext, useContext, ReactNode } from 'react';
import { SubthemeName } from './subtheme';

export interface StyleDomainInfo {
  /** Semantic status a whole subtree should adopt, e.g. an entire form section in an error state. */
  subtheme?: SubthemeName;
}

export const StyleDomainContext = createContext<StyleDomainInfo | null>(null);

export interface StyleDomainProviderProps extends StyleDomainInfo {
  children: ReactNode;
}

/**
 * Establishes a semantic-visual "style domain" for a subtree — the
 * non-containment counterpart to `LayoutDomainProvider`
 * (`components/Splitter/LayoutDomainContext.tsx`). A descendant component
 * that has migrated to the `overrides` mechanism resolves its subtheme as
 * `overrides.subtheme ?? useStyleDomain()?.subtheme` (instance beats
 * domain beats nothing).
 *
 * Deliberately Context-based, not CSS-variable inheritance: Modal, Popup,
 * and SlideOut all render their content through a portal to
 * `document.body`, and CSS custom properties only cascade through the
 * real DOM tree, not the React tree — a value set via inline style on an
 * ancestor in JSX would never reach portaled descendants. React Context
 * follows the component tree regardless of portals, so it's the only
 * mechanism that works uniformly for every component, portaled or not.
 */
export const StyleDomainProvider: React.FC<StyleDomainProviderProps> = ({ children, ...domain }) => (
  <StyleDomainContext.Provider value={domain}>{children}</StyleDomainContext.Provider>
);

/**
 * useStyleDomain Hook
 * Reads the nearest ancestor style domain, if any. Returns `null` outside
 * any `<StyleDomainProvider>`.
 */
export function useStyleDomain(): StyleDomainInfo | null {
  return useContext(StyleDomainContext);
}
