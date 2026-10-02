import { useMemo, useSyncExternalStore } from 'react';

// The demo's router (issue #624): the whole navigation state lives in the
// URL hash, so browser back/forward, reloads and shared links all work, and
// the Catalog can show one component per page instead of mounting
// every live demo at once.
//
//   #/overview                     Overview & Architecture
//   #/kits                         Kits
//   #/catalog                 the shadow board (index)
//   #/catalog/Button          one component's page
//   #/catalog/system/toasts   one Systems area's page
//
// Only hashes starting with `#/` are routes. Anything else -- a demo's own
// `<Link href="#">`, HoverCard's `#profile` -- leaves the current route
// alone, so those links stay inert instead of bouncing back to Overview.

export type Route =
  | { page: 'overview' }
  | { page: 'kits' }
  | { page: 'catalog'; entry?: string; system?: string };

const DEFAULT_HASH = '#/overview';

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'kits':
      return { page: 'kits' };
    case 'catalog':
      if (parts[1] === 'system' && parts[2]) return { page: 'catalog', system: parts[2] };
      return parts[1] ? { page: 'catalog', entry: parts[1] } : { page: 'catalog' };
    default:
      return { page: 'overview' };
  }
}

/** The `href` for a route -- `routeHref({ page: 'catalog', entry: 'Button' })` is `#/catalog/Button`. */
export function routeHref(route: Route): string {
  if (route.page !== 'catalog') return `#/${route.page}`;
  if (route.system) return `#/catalog/system/${encodeURIComponent(route.system)}`;
  if (route.entry) return `#/catalog/${encodeURIComponent(route.entry)}`;
  return '#/catalog';
}

/** Navigates by setting the hash, which pushes a history entry -- back/forward just work. Accepts `/kits` or `#/kits`. */
export function navigateHash(to: string): void {
  window.location.hash = to.startsWith('#') ? to.slice(1) : to;
}

let lastRouteHash = DEFAULT_HASH;

function readRouteHash(): string {
  const hash = window.location.hash;
  if (hash.startsWith('#/')) lastRouteHash = hash;
  return lastRouteHash;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/** The current route, re-rendering on every hash change (link click, back/forward, `navigateHash`). */
export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, readRouteHash, () => DEFAULT_HASH);
  return useMemo(() => parseRoute(hash), [hash]);
}
