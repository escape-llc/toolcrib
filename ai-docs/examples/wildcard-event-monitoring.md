# Worked Example: Wildcard Event Monitoring

`aiBus` already emits a comprehensive, semantic vocabulary of every
meaningful UI interaction — a modal opening, a form submitting, a
command-palette item selected. Forwarding that to an analytics or
telemetry pipeline isn't a new feature to build; it's composition over a
mechanism that already exists.

## The mechanism: `on('*', ...)`

Subscribing to `'*'` receives every event the bus ever emits, wrapped as
`{ type, detail }` rather than the event's own bare payload:

```ts
import { aiBus } from '#toolcrib';

aiBus.on('*', ({ type, detail }) => {
  console.log('bus event:', type, detail);
});
```

`type` is the event name (`'modal:shown'`, `'form:submitted'`, ...);
`detail` is that event's own payload, unchanged. This is real internal
plumbing, not a shim built for this example — `openModal`, `showToast`,
and every other helper method still go through the same `emit()` path,
so the wildcard subscriber sees them all.

## Caveat: high-frequency channels flood a naive forwarder

Some channels (`element:resized`, `viewport:resized`) fire constantly —
forwarding every one of them to an analytics pipeline as its own event
generates enormous noise for approximately zero insight. Allowlist which
channels are actually worth tracking, rather than forwarding everything:

```ts
const TRACKED = new Set(['modal:shown', 'form:submitted', 'toast:shown', 'commandpalette:item_selected']);

aiBus.on('*', ({ type, detail }) => {
  if (!TRACKED.has(type)) return;
  analytics.track(type, detail);
});
```

## Caveat: not every payload is JSON-serializable

A few payloads carry a live DOM reference — `element:resized`'s own
shape is:

```ts
{ id?: string; target: HTMLElement; width: number; height: number; contentHeight: number }
```

Most analytics SDKs expect a plain JSON-serializable object and will
throw or silently drop a call carrying an `HTMLElement`. Strip or
allowlist the fields actually being forwarded rather than passing
`detail` straight through:

```ts
aiBus.on('*', ({ type, detail }) => {
  if (!TRACKED.has(type)) return;
  const { target, ...safeDetail } = detail as any;
  analytics.track(type, safeDetail);
});
```

## A sibling pattern already in place: `error:boundary`

The same wildcard mechanism, scoped to a single channel, is how
`<AIErrorBoundary>` reports a caught render error — see the `error:boundary`
entry in the Event Bus reference. Forwarding *that* one channel to a real
error-reporting service (Sentry, Bugsnag) is the identical shape of
composition as this file describes for analytics generally: subscribe,
forward, done. Reach for a single `aiBus.on('error:boundary', ...)`
subscription for that narrower case rather than filtering it out of a
wildcard stream built for everything else.
