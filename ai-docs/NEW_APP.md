# Toolcrib — New Project Setup

Use alongside `CORE.md` when `toolcrib` is the UI layer from day one — there's no existing styling or component system to reconcile with. If you're adding `toolcrib` to a codebase that already has UI, read `REFACTOR_APP.md` instead.

## 1. Install the toolkit

```bash
npx toolcrib init
toolcrib apply
```

This vendors the toolkit into `./toolcrib/` and wires the `#toolcrib` import (see `CORE.md`). Nothing else in your project is touched.

## 2. Wire the root providers — do this before writing any other component

```tsx
// main.tsx / index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, ToastProvider, ToastContainer } from '#toolcrib';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <ToastProvider>
      <App />
      <ToastContainer />
    </ToastProvider>
  </ThemeProvider>
);
```

Nothing themed will render correctly, and `useToast()` / `aiBus.showToast()` will either throw or silently do nothing, until this is in place. See `CORE.md` §1 for why both `ToastProvider` and `ToastContainer` are required.

## 3. Build every screen from toolcrib components — there's nothing to preserve

Because this is a new project, there is no legacy CSS or duplicated overlay code to work around. Default to the strictest reading of `CORE.md`'s anti-pattern table from the first component you write:

- Every panel is a `<Card>`, `<VStack>`/`<HStack>`, or `<Grid>` — never a bare `<div style={{padding: ...}}>`.
- Every dialog/drawer/popover is `<Modal>` / `<SlideOut>` / `<Popup>` — never a hand-rolled `useState` + `position: fixed` pair.
- Every form is a `<Form schema={...}>` — never manual `onChange`/`register()` wiring.
- Cross-component actions (e.g. a table row's delete button opening a confirmation dialog elsewhere in the tree) go through `aiBus`, not props threaded down and callbacks threaded back up.

There is no cost to strict adherence here — you aren't fighting existing patterns, so there's no reason to reach for a one-off `style` prop "just this once."

## 4. Tune the palette with the Theme Editor, don't hand-pick colours

Drop `<ThemeEditor trigger={...}>` somewhere reachable early in development (a debug toolbar, a temporary route) and use it to pick the base colour, harmony mode, and spacing scale interactively. Once you're happy, read the resulting `parameters` off `useTheme()` and pass them as `<ThemeProvider initialParameters={...}>` so the app starts pre-themed instead of flashing the default palette on load. Don't hardcode individual `--ai-*` CSS variable overrides by hand — that's the same ad-hoc-CSS anti-pattern `CORE.md` warns against, just aimed at the theme layer instead of component styles.

## 5. Common first-run mistakes

- **Toasts silently do nothing.** `aiBus.showToast()` and `addToast()` both update state and emit bus events regardless of whether `<ToastContainer>` is mounted — so this fails silently, not loudly. If a toast call "does nothing," check for `<ToastContainer>` first.
- **Components render unthemed (system-default colours/spacing).** Means `<ThemeProvider>` isn't mounted above them, or the component tree is rendering before `ThemeProvider`'s first effect run — check that `ThemeProvider` wraps the actual render root, not a sub-tree.
- **`useTheme()` / `useToast()` throws "must be used within a ...Provider".** The component calling the hook is rendered outside that provider's subtree — usually a sign a portal or a router outlet escaped the provider tree. Providers must wrap everything that uses toolcrib, including anything rendered via `createPortal` elsewhere in the app.
- **Overlays/tabs/accordion appear/disappear instantly instead of fading, sliding, or scaling.** Known current limitation, not a mistake in your code: the `@keyframes` these components reference in their inline `animation` styles (`ai-fade-in`, `ai-scale-in`, `ai-slide-in-*`, `ai-accordion-slide-*`) aren't vendored by `toolcrib init` yet. Functionality (open/close, focus trap, dismiss) is unaffected — only the transition is missing.
