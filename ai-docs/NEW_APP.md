# Toolcrib — New Project Setup

Use alongside `CORE.md` when `toolcrib` is the UI layer from day one — there's no existing styling or component system to reconcile with. If you're adding `toolcrib` to a codebase that already has UI, read `REFACTOR_APP.md` instead.

## 0. TypeScript is required

Scaffold the project with a TypeScript template from the start — `npm create vite@latest my-app -- --template react-ts` (or the equivalent for your framework/bundler), not the plain JS variant. This isn't a style preference: every toolcrib component ships a full, exact prop type, specifically so an invalid value — a typo'd `variant`, a misspelled event name, a prop that doesn't exist on that component — fails at compile time instead of shipping silently. A `.jsx` project gets none of that protection; `tsc` doesn't type-check plain JS/JSX by default, so an invalid prop only surfaces if and when it happens to visually collide with something else and gets noticed by eye. Confirmed as a real failure mode, not hypothetical: a real consumer app passed `variant="solid"` — not a value any toolcrib `Button` variant accepts — and it shipped invisibly for the life of the project until it visually collided with an unrelated layout change. `toolcrib doctor` flags a missing `tsconfig.json` on every run for exactly this reason.

### Already started in JavaScript?

Convert before continuing to build with toolcrib — the further a plain-JS project gets, the more retroactive type errors accumulate at once, and every one of them was already a real (if invisible) bug.

1. `npm install -D typescript @types/react @types/react-dom` (add `@types/node` too if your bundler config file, e.g. `vite.config`, touches Node APIs).
2. Add a `tsconfig.json` — copy one from your framework's own TypeScript template rather than hand-writing it (e.g. scaffold `npm create vite@latest tmp-ts -- --template react-ts` into a scratch directory and copy its `tsconfig*.json` files over, then delete the scratch directory).
3. Rename every `.jsx` file, and every `.js` file that contains JSX, to `.tsx`. A `.js` file with no JSX in it can become plain `.ts`. Update whatever references the old entry-point filename (`index.html`, your bundler config).
4. Run `npx tsc --noEmit` and fix what it reports. This is the step that actually pays off the conversion — every prop type toolcrib ships now applies to your existing call sites, surfacing errors that were always there and invisible until now.
5. Re-run `toolcrib doctor` to confirm its TypeScript check clears.

## 1. Install the toolkit

```bash
npx toolcrib init
toolcrib apply
```

This vendors the toolkit into `./toolcrib/` and wires the `#toolcrib` import (see `CORE.md`). Nothing else in your project is touched.

**Never specify a version number** — not for `npx toolcrib` itself, not for any `--version` flag on `init`/`merge`. The CLI (published as `toolcrib` on npm) and the toolkit content it downloads (a separate GitHub Release) are two independent version numbers with no relationship to each other — the CLI's own version has nothing to do with which toolkit release you get, and there is no reason to align them. Run the commands exactly as shown, with no version pin at all; the defaults already resolve to the latest of each. If you need to confirm which toolkit content version actually landed, check `./toolcrib/toolcrib.config.json`'s own `"version"` field after `apply` — not any npm package version.

## 2. Wire the root providers — do this before writing any other component

```tsx
// main.tsx / index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToolcribProvider } from '#toolcrib';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ToolcribProvider>
    <App />
  </ToolcribProvider>
);
```

Nothing themed will render correctly, and `useToast()` / `aiBus.showToast()` will either throw or silently do nothing, until this is in place. See `CORE.md` §1 for what `ToolcribProvider` composes and why.

## 3. Build every screen from toolcrib components — there's nothing to preserve

Because this is a new project, there is no legacy CSS or duplicated overlay code to work around. Default to the strictest reading of `CORE.md`'s anti-pattern table from the first component you write:

- Every panel is a `<Card>`, `<VStack>`/`<HStack>`, or `<Grid>` — never a bare `<div style={{padding: ...}}>`.
- Every dialog/drawer/popover is `<Modal>` / `<Drawer>` / `<Popup>` — never a hand-rolled `useState` + `position: fixed` pair.
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
