# Worked Example: SSR-Safe Theme Injection

`<ThemeProvider>` injects every `--ai-*` CSS variable via a client-only
`useEffect` — so a server-rendered page (Next.js, Remix) ships default,
unthemed HTML and visibly flashes to the real theme once hydration runs.
`computeServerThemeCSS()` is the one new pure, DOM-free entry point that
closes that gap: it computes the exact same CSS `<ThemeProvider>` would
eventually apply, as plain text, for your own SSR framework to render
synchronously in the initial HTML.

## The one rule that matters: use the exported ids, not your own

```ts
import {
  computeServerThemeCSS,
  TOOLCRIB_TYPOGRAPHY_BASE_STYLE_ID,
  TOOLCRIB_RESPONSIVE_STYLE_ID,
  TOOLCRIB_THEME_TRANSITIONS_STYLE_ID,
} from '#toolcrib';
import { TOOLCRIB_SHARED_KEYFRAMES_STYLE_ID } from '#toolcrib';
```

`injectGlobalStyle`/`upsertGlobalStyle` — the mechanism `<ThemeProvider>`'s
own client-side effects use — dedup by looking up an element with a
specific `id`. Render your SSR `<style>` tags under these exact ids and
hydration recognizes them as already present: no duplicate tag, and a
later live update (e.g. `setPaddingMode`) correctly updates the *same*
tag. Invent your own id instead, and the mismatch is silent — no error,
just a second tag alongside the first, and for the responsive one, every
future live update lands on the new copy while the SSR-rendered one goes
stale.

## Next.js App Router: root layout

```tsx
// app/layout.tsx
import {
  computeServerThemeCSS,
  TOOLCRIB_TYPOGRAPHY_BASE_STYLE_ID,
  TOOLCRIB_RESPONSIVE_STYLE_ID,
  TOOLCRIB_SHARED_KEYFRAMES_STYLE_ID,
  TOOLCRIB_THEME_TRANSITIONS_STYLE_ID,
} from '#toolcrib';
import { Providers } from './providers'; // a client component wrapping <ThemeProvider>

const initialParameters = { baseColor: { h: 217, s: 76, v: 96 }, isDarkMode: true };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = computeServerThemeCSS(initialParameters);
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: theme.rootVariablesCSS }} />
        <style id={TOOLCRIB_TYPOGRAPHY_BASE_STYLE_ID} dangerouslySetInnerHTML={{ __html: theme.typographyCSS }} />
        <style id={TOOLCRIB_SHARED_KEYFRAMES_STYLE_ID} dangerouslySetInnerHTML={{ __html: theme.keyframesCSS }} />
        <style id={TOOLCRIB_THEME_TRANSITIONS_STYLE_ID} dangerouslySetInnerHTML={{ __html: theme.transitionsCSS }} />
        {theme.responsiveCSS && (
          <style id={TOOLCRIB_RESPONSIVE_STYLE_ID} dangerouslySetInnerHTML={{ __html: theme.responsiveCSS }} />
        )}
      </head>
      <body>
        <Providers initialParameters={initialParameters}>{children}</Providers>
      </body>
    </html>
  );
}
```

The same `initialParameters` object has to reach both the server call and
the client `<ThemeProvider initialParameters={...}>` inside `Providers`.
If they diverge, nothing breaks or duplicates (the id-based dedup above
doesn't care what content it finds), but the flash-of-unstyled-content fix
only covers whichever parameters actually made it into the SSR call — the
client's first commit still repaints to whatever `<ThemeProvider>` was
actually given.

## Why `rootVariablesCSS` doesn't need a fixed id

The client's own injection effect writes these as inline properties on
`documentElement.style`, not as a stylesheet rule — an inline write is
idempotent (setting the same custom property to the same value twice has
no effect), so there's no id-based dedup to align with here. Render
`rootVariablesCSS` under any `<style>` tag; the exact ids above only
matter for the other four pieces.

## CSP nonce

`computeServerThemeCSS` returns plain text, not DOM nodes, so it takes no
`nonce` parameter — there's nothing for it to attach one to. If your app
runs a strict, nonce-based CSP (`style-src` with no `'unsafe-inline'`),
attach your request's real nonce to each `<style>` tag yourself in the
render code above, exactly as `<ThemeProvider>`'s own `nonce` prop does
for its client-side tags.
