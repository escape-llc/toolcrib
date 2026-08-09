# Toolcrib — Adopting Into an Existing App

Use alongside `CORE.md` when introducing `toolcrib` into a codebase that already has UI components, styling, and state management. If you're starting a project from scratch, read `NEW_APP.md` instead.

## 1. Install and check for drift

```bash
npx toolcrib init      # first time
npx toolcrib doctor     # already installed: read-only check for local edits + available updates
npx toolcrib merge      # already installed: stage an upgrade to a newer version
```

`doctor` and `merge` only ever compare files under `./toolcrib/` — they have no visibility into anything you've hand-written elsewhere, including whatever you've pasted from `ai-docs/` into your own `AGENTS.md`/`CLAUDE.md`. Re-check those manually against `./toolcrib/ai-docs/CORE.md` after every `merge`.

## 2. Wire the root providers exactly once

See `CORE.md` §1 for the full snippet (`ThemeProvider` + `ToastProvider` + `ToastContainer`). Before adding it, check whether your app already has an equivalent from another UI kit (a theme context, a toast/snackbar provider):

- **Toasts/snackbars**: if one already exists, don't run both — pick one system per app. Either keep the existing one and skip toolcrib's `<Toast>` components entirely (fine — the rest of the toolkit doesn't depend on it), or migrate call sites to `aiBus.showToast()` and remove the old provider.
- **Theming**: `<ThemeProvider>` only manages the `--ai-*` CSS custom property namespace — it doesn't read or write any other theme system's variables/context. It's safe to mount alongside an existing theme provider (e.g. one driving a different component library) as long as the two don't target the same DOM elements.

## 3. Adopt incrementally — don't rewrite everything at once

Convert one screen or one component category at a time, starting wherever the pain that motivated adopting toolcrib is worst — usually the components explicitly called out in `CORE.md`'s anti-pattern table:

1. **Duplicated overlay implementations first.** Grep for repeated `useState` pairs like `isOpen`/`setIsOpen` combined with `position: fixed` or a hand-rolled backdrop `<div>` — these are the most duplicated, least accessible custom code in most vibe-coded apps, and `<Modal>`/`<SlideOut>`/`<Popup>` replace them directly without touching surrounding logic.
2. **New screens/features next.** Build anything new entirely in toolcrib components, even while older screens still use the legacy system. There's no requirement that the whole app adopt toolcrib atomically.
3. **Existing screens last, and only if they're actively being touched.** Don't do a drive-by rewrite of a screen you weren't already changing — that's scope creep, not migration.

## 4. Identify what to replace

Search for these patterns as migration candidates — each maps directly to a `CORE.md` anti-pattern:

- Hardcoded hex/rgb colors (`#3b82f6`, `rgb(...)`) → replace with the matching `var(--ai-*)` token once the component is under `<ThemeProvider>`.
- `px` values in inline styles or CSS modules for spacing/radii → `rem`, or a toolcrib layout primitive (`<VStack gap>`, `<Card>`) that already resolves the right token.
- Manual `z-index: 9999`-style overlay stacking → the `Z_INDEX` scale, once the overlay itself moves to `<Modal>`/`<Popup>`/`<SlideOut>`.
- Prop-drilled `onClose`/`onOpen` callbacks passed through 3+ component layers → `aiBus.emit()` / `useAIEvent()`.

Don't do a global find-and-replace across the whole codebase in one pass — migrate a component's styling only when you're already replacing that component's structure, per §3.

## 5. Coexisting with your existing CSS

Toolcrib's own component styles are applied via inline `style={{...}}` objects that resolve `var(--ai-*)` custom properties — not via global class selectors — so there's little risk of a toolcrib component picking up unrelated global CSS rules, or vice versa. The exceptions:

- `<ThemeProvider>` sets `--ai-*` custom properties on `document.documentElement` (`:root`). If your existing CSS already defines any of those exact variable names for something unrelated, there will be a collision — check for a `--ai-` prefix in your existing stylesheets before adopting.
- A few components (`<UIGroup>`, `<Accordion>`) inject a `<style>` tag with a small number of scoped class selectors (`toolcrib-group`, `.ai-accordion-*`) for hover/focus-stacking and open/close animations. These are distinct enough names that a collision with existing app CSS is unlikely, but not architecturally impossible if your own CSS happens to use the same class names.
- Global resets in your existing CSS (`* { box-sizing: border-box }`, global `button { ... }` rules, CSS resets/normalize.css) can still visually affect toolcrib components, since toolcrib doesn't defensively override every inherited property. If toolcrix components look subtly off (wrong box-sizing, unexpected button borders), check your global stylesheet first.

## 6. Coexisting with your existing state management

`aiBus` is for **cross-tree UI orchestration** — "open this modal," "show this toast," "a tab changed" — not a general-purpose app state store. Don't route business/domain data through it as a Redux/Zustand/Context replacement:

- Keep data fetching, mutations, and domain state in your existing store exactly as-is.
- Use `aiBus` only for the UI-level side effect of that state changing (e.g. after a successful delete mutation in your existing data layer, call `aiBus.showToast('Deleted', 'success')` — don't move the delete logic itself onto the bus).
- If a toolcrib component's callback (e.g. `<Form onSubmit>`) needs to trigger your existing state management, call into it directly from that callback — there's no need to bounce through `aiBus` just because toolcrib is involved.

## 7. Common issues specific to migration

- **A converted component looks unstyled or partially styled.** Almost always means it's rendering outside `<ThemeProvider>`'s subtree — common when a component is portaled (modals, tooltips) from a part of the tree that predates the provider being added. Confirm `<ThemeProvider>` wraps the actual React root, not a sub-section of it.
- **Overlays/tabs/accordion appear/disappear instantly instead of animating.** Known current limitation, not specific to migration: the `@keyframes` these components reference (`ai-fade-in`, `ai-scale-in`, `ai-slide-in-*`, `ai-accordion-slide-*`) aren't vendored by `toolcrib init` yet. Open/close/focus-trap functionality is unaffected.
- **Two toast/notification stacks appear at once.** Sign that both the legacy notification system and toolcrib's `<ToastContainer>` are mounted and both wired to the same trigger path — see §2.
