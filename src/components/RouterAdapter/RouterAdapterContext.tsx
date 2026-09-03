import React, { createContext, useContext, type ReactNode } from 'react';
import { useAIEvent } from '../../eventBus/useAIEvent';
import { isDevBuild } from '../../theme/safeProps';

/**
 * Router-agnostic navigation contract. Build one of these from whatever
 * router library your app actually uses (React Router's `useNavigate()`,
 * TanStack Router's `useNavigate()`, Next's `useRouter().push`, etc) and
 * supply it via `<RouterAdapterProvider>`. toolcrib itself never imports a
 * router library — this interface is the entire surface of that boundary.
 * @barrelExport
 */
export interface RouterAdapter {
  navigate: (to: string) => void;
}

const RouterAdapterContext = createContext<RouterAdapter | undefined>(undefined);

export interface RouterAdapterProviderProps {
  adapter: RouterAdapter;
  children: ReactNode;
}

/**
 * Bridges `aiBus`'s `route:navigate` event to a real router. Mount once,
 * INSIDE your actual router's tree (wherever `useNavigate()` or its
 * equivalent is real) — not at the same level as `<ToolcribProvider>`,
 * which typically sits above the router. No `@manifest` tag, matching
 * `ToolcribProvider`'s own precedent: no direct UI/DOM output, so
 * `CORE.md` prose / the router-integration worked example is the
 * documentation surface, not the generated manifest.
 * @barrelExport
 */
export const RouterAdapterProvider: React.FC<RouterAdapterProviderProps> = ({ adapter, children }) => {
  return <RouterAdapterContext.Provider value={adapter}>{children}</RouterAdapterContext.Provider>;
};

/**
 * Subscribes to `aiBus`'s `route:navigate` event and forwards `to` to
 * whatever adapter was supplied above via `<RouterAdapterProvider>`.
 * Mount once, anywhere below that provider.
 *
 * One-directional by design: this bridges component → router (an
 * imperative "go here" request), never the reverse. A browser back/forward
 * navigation is handled entirely by the router library itself (`popstate`
 * → route re-match) and never touches `aiBus` or this hook at all.
 * Reconstructing toolcrib UI state after such a navigation — which modal
 * is open, which tab is active — is the consumer's own responsibility via
 * controlled props derived from the router's live state on every render;
 * see `ai-docs/examples/router-integration.md`.
 *
 * If no `<RouterAdapterProvider>` is mounted above the caller, this is a
 * no-op — with a dev-only `console.warn` the moment a navigation is
 * actually attempted, not on mount. Deliberate deviation from
 * `useTheme()`/`useToast()`'s hard throw: routing is opt-in
 * infrastructure (a router-less dashboard or embedded widget is a
 * perfectly valid toolcrib consumer), so nothing should force every
 * non-routed app to avoid this hook defensively. The warning is tied to
 * the actual broken interaction — someone called `aiBus.navigate()` and
 * nothing happened — which is the moment a developer needs the signal,
 * not mount time.
 * @barrelExport
 */
export function useRouterBridge(): void {
  const adapter = useContext(RouterAdapterContext);

  useAIEvent('route:navigate', ({ to }) => {
    if (!adapter) {
      if (isDevBuild()) {
        console.warn(
          '[toolcrib] useRouterBridge(): aiBus.navigate() was called but no <RouterAdapterProvider> is mounted above this component — navigation was ignored. Wrap your router tree in <RouterAdapterProvider adapter={...}>.'
        );
      }
      return;
    }
    adapter.navigate(to);
  });
}
