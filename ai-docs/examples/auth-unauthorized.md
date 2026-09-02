# Worked Example: Auth-Unauthorized Announcements

toolcrib has no concept of sessions, tokens, or permissions — and doesn't
need one. An app's own code already knows the moment a session becomes
unauthorized (an API client's 401 handler, a token-expiry timer, a failed
permission check); `aiBus.requireAuth()` is just the standard channel that
fact travels through, so cross-tree UI can react without prop-drilling a
callback down to wherever the check happens to run.

## Announce it from wherever the check actually happens

```ts
import { aiBus } from '#toolcrib';

async function apiFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (res.status === 401) {
    aiBus.requireAuth('token-expired');
  }
  return res;
}
```

`requireAuth(reason?)` is a one-liner around `emit('auth:unauthorized', { reason })` —
the payload:

```ts
{ reason?: string }
```

## React to it from one persistently-mounted listener

Mount this once, near the root — next to wherever `<ToastContainer>` or
the router bridge (`useRouterBridge()`, see the router-integration
example) already live — not per-component. `auth:unauthorized` is
deliberately **not** sticky: the same reasoning as `route:navigate`, a
persistently-mounted subscriber is expected to always be listening, so
there's no late-mount race to replay for.

```tsx
import { useAIEvent, aiBus } from '#toolcrib';

function AuthListener() {
  useAIEvent('auth:unauthorized', () => {
    clearStoredToken();
    aiBus.navigate('/login');
  });
  return null;
}
```

What "unauthorized" actually means is entirely up to the app — clearing a
token and redirecting via the router bridge above, opening a login
`Modal` in place instead, or simply showing a toast are all equally valid
reactions to the same announcement. toolcrib doesn't prescribe one; it
only guarantees the announcement itself has one standard shape to listen
for, from anywhere in the tree.
