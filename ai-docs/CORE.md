# Toolcrib — Core Reference & System Prompt

`toolcrib` is a React component library designed specifically for AI code generation ("vibe coding"). It provides structural UI components, slot-based composition without prop-drilling, a strongly-typed Event Bus, a Zod 4 form validation engine, and an HSV-based CSS variable theme system.

**Always include this file's content in your system instructions** (Cursor `.cursorrules`, `AGENTS.md`, `CLAUDE.md`, Custom GPTs) when working in a project that uses `toolcrib`. In addition to this file, also include exactly one of:
- **`NEW_APP.md`** — starting a project from scratch with `toolcrib` as the UI layer from day one.
- **`REFACTOR_APP.md`** — introducing `toolcrib` into a codebase that already has UI, styling, and state management.

If the codebase (or the person driving the session) already thinks in Tailwind's utility-class vocabulary specifically, also read `TAILWIND.md` — a short vocabulary lookup, not a third required document.

> **Two documents, two different jobs — load both.** This file is the source of truth for **rules, conventions, and behavior**: what's forbidden, why, and how the pieces fit together. **`component-manifest.json`** is the source of truth for **exact, enumerable data**: every component's full prop list with types/defaults/required flags, the complete `--ai-*` CSS variable list, the full event-channel/payload table, and the z-index scale. It's generated directly from source (`scripts/generate-manifest.js`) and kept in sync by a CI check — so it cannot go stale the way hand-maintained prose can. Where this file gives you a short pointer instead of a full table, that's intentional: **consult the manifest, don't guess or recall from memory.**

> **Reading strategy for the Component Reference (§5) and the manifest.** §5's table already gives you every component's name, slots, and prop *names* — enough to pick the right component and call it correctly by convention. Read `component-manifest.json` (or its per-category split, next) only when §5 doesn't tell you enough: exact prop types, `@default` values, `required` flags, or slot-prop shapes. When you do, prefer the split file under `ai-docs/manifest/<category-slug>.json` for the category you're working in (e.g. `ai-docs/manifest/data-display.json` for `<DataTable>`) — same content as that category in `component-manifest.json`, a fraction of the size. `component-manifest.json` itself remains the single source of truth for the non-component-specific data (`themeSystem`, `zIndexScale`, `eventBus`) and for anything spanning more than one category at once. Worked examples for mechanisms with no prior in ordinary React/Radix training data — `overrides`+`StyleDomain` composition, the event bus's sticky-replay semantics, the z-index scale, translating a design brief directly into `ThemeParameters` — live under `ai-docs/examples/`; read the relevant one before touching one of those mechanisms for the first time in a session.

> **If `toolcrib-mcp` tools are available, prefer them.** If tools like `list_components`, `get_component`, or `search_components` are visible in your current tool set, use them instead of reading `component-manifest.json`/`ai-docs/manifest/*.json` directly — same underlying data, kept current with whatever's actually vendored in this project, plus real fuzzy search. The file-based reading strategy above is the fallback for when they aren't available, which is still the default unless this project has explicitly installed and configured `toolcrib-mcp`. One exception: `get_theme_system` is reference-only (CSS variable names/roles, supported harmonies, the z-index scale) — it does not compute actual resolved CSS values for a given theme config, so don't rely on it for that.

> **Import path.** After `toolcrib init` / `toolcrib apply`, the toolkit is vendored into `./toolcrib/` and wired to the `#toolcrib` subpath import via your `package.json`'s `"imports"` field — never `from 'toolcrib'` or a relative path. This is the one specifier that works identically from any file in your project, regardless of location or bundler:
> ```tsx
> import { Card, aiBus } from '#toolcrib';
> ```

> **All units are `rem`** (derived from `--ai-master-font-size` in `px`). Never hardcode `px` values.

> **React version.** toolcrib supports **React 18.3+ and React 19.x** — whichever major this project is already scaffolded with (or gets scaffolded with) is fine as-is. Don't add a step to pin, downgrade, or upgrade React to some assumed "correct" version for toolcrib's sake; there isn't one. `toolcrib init`/`apply` only ever flags a real mismatch (e.g. React 16 or 17) as a dependency conflict requiring a decision — React 18 and 19 both resolve as compatible automatically. (Kept in sync with `PEER_DEPENDENCY_RANGE_OVERRIDES` in `scripts/build-release.js` — see that file if this ever needs to widen further, e.g. for a future React 20.)

---

## 1. Root Setup

Wrap your app root in `<ToolcribProvider>` exactly once — components will throw ("must be used within a ...Provider") or silently no-op without it:

```tsx
import { ToolcribProvider } from '#toolcrib';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ToolcribProvider>
    <App />
  </ToolcribProvider>
);
```

`ToolcribProvider` composes `ThemeProvider` > `ToastProvider` > `LocaleProvider` > your app + `ToastContainer`, in the one correct nesting order, so there's no separate `ToastContainer` to remember and no ordering to get wrong. (Omitting it used to be a common silent failure with manual wiring: `aiBus.showToast()` / `addToast()` still updated state and emitted bus events, but nothing appeared on screen.) Its own `theme`/`toast`/`strings` props pass straight through to the underlying providers — `theme` takes everything `ThemeProvider` itself accepts (`initialParameters`, `initialSliceStates`, `targetDocument`), `toast` takes everything `ToastProvider` accepts (`defaultAnchor`), `strings` takes a `LocaleStringsOverride` (see below).

For advanced composition — interleaving with a Router, Redux, or an Auth context at a specific nesting depth — `ThemeProvider`, `ToastProvider`, and `ToastContainer` are still individually exported and can be wired by hand in whatever order your app needs:

```tsx
import { ThemeProvider, ToastProvider, ToastContainer } from '#toolcrib';

<ThemeProvider>
  <ToastProvider>
    <App />
    <ToastContainer />
  </ToastProvider>
</ThemeProvider>
```

`ThemeProvider` injects the HSV-derived CSS variables at `:root` on mount — nothing themed will render correctly without it. `ToastProvider` + `ToastContainer` are independent of `ThemeProvider` but must both be present together (the provider holds state; the container renders it). That injection is client-only, so a server-rendered page (Next.js, Remix) flashes unthemed content until hydration — `computeServerThemeCSS()` computes the same CSS as plain text for your own SSR framework to render synchronously instead. See `ai-docs/examples/ssr-theme-injection.md` for the full pattern, including which element ids matter for hydration to recognize it without duplicating.

For triggering navigation from anywhere in the tree via `aiBus.navigate()` — a `CommandPalette` item, a toast action, a modal confirm handler — mount `<RouterAdapterProvider adapter={...}>` once inside your actual router's tree (supplying `navigate` from whatever router library you use) and call `useRouterBridge()` once beneath it. See `ai-docs/examples/router-integration.md` for the full pattern, including controlled-overlay and `TabStrip` URL-sync approaches that don't need the event bus at all.

`<LocaleProvider strings={...}>` batch-overrides every localizable UI chrome string (`Pagination`'s "Previous page", `Tree`'s root `aria-label`, and others) in one place — pass it directly to `ToolcribProvider`'s own `strings` prop, or mount `<LocaleProvider>` standalone for advanced composition. Optional and graceful like `RouterAdapterProvider`, not required-and-throws like `ThemeProvider`: every string already has a harmless English default, so not mounting it changes nothing. Distinct from `<Calendar>`'s own `locale` prop (a BCP 47 tag for real date-name localization, untouched by this). See `ai-docs/examples/locale-provider.md`.

`aiBus.requireAuth(reason?)` announces that the current session/request is unauthorized (an API 401, a token expiry) from wherever that check actually happens, without prop-drilling a callback down to it — a persistently-mounted listener elsewhere in the tree decides what "unauthorized" means for your app. See `ai-docs/examples/auth-unauthorized.md`. `aiBus.onAny(...)`/`useAnyAIEvent(...)` (the wildcard subscription every event already passes through) is the same shape of mechanism generalized to forwarding toolcrib's whole event vocabulary somewhere else — see `ai-docs/examples/wildcard-event-monitoring.md`. For the specific case of reporting real end-user interaction analytics to your own destination, `useInteractionAnalytics(report, options?)` builds on that same wildcard stream but adds the privacy discipline that raw forwarding doesn't have for free: it reports event type plus a small, fixed allowlist of static identifier fields (`id`/`formId`/`name`/`componentName`) by default, never a raw payload — several channels carry real end-user data (`form:submitted.values`, `toast:shown.message`, every `*:changed` event's own `value`) or a raw DOM node (`element:resized`'s `target`) that a naive forwarder would leak. Pass `{ sanitize: (type, payload) => ... }` to replace the default allowlist entirely — call `defaultInteractionAnalyticsSanitizer(type, payload)` yourself first if you want the safe default plus a few more fields, rather than reimplementing it.

---

## 2. Recommended Complementary Packages

Router/auth/analytics above (§1) work through a library-agnostic adapter, so toolcrib never has to pick one. The table below is different in kind — a concern with no adapter shape possible, where the pick genuinely matters and this list exists to keep an agent from picking a different one on every project. Deliberately short: an entry only belongs here if there's no adapter that could sidestep the choice instead, and the recommendation is close to a real consensus pick, not a preference call. None of these are added to toolcrib's own dependencies by installing it — they're guidance for your project, not something `toolcrib init` vendors or wires in.

| Need | Recommended | Why |
|---|---|---|
| App-level shared state (not cross-component UI signaling — that's `aiBus`, see §11) | [Zustand](https://github.com/pmndrs/zustand) | Small, hooks-based, no provider ceremony — the closest thing to a consensus pick in this space, and what an AI agent already reaches for by training-data prior more often than not. |
| Unit tests | [Vitest](https://vitest.dev/) | What toolcrib's own component suite runs on (Vite-native, fast) — pairs naturally with a Vite-based project, and is the framework toolcrib's own separately-shipped, opt-in test files are written against. |
| Linting | [ESLint](https://eslint.org/) (flat config) | Required to actually run the vendored rules in `eslint-rules/` (`no-unexplained-zindex`, `no-computed-prop-before-spread`, `no-missing-use-client`, `no-frozen-controlled-prop`, and the two "stay in theme" rules for principle 7: `prefer-toolcrib-component`, `no-literal-style-values`) — see that directory's own `README.md` for wiring instructions. |

---

## 3. Core Principles

1. **NO Prop-Drilling.** Use slot subcomponents (e.g. `<Card.Header>`, `<Modal.Actions>`) and React contexts.
2. **Cross-Tree Actions via Event Bus — for components with no direct ancestor/descendant relationship.** Trigger overlays, toasts, and form actions from anywhere:
   ```tsx
   import { aiBus, useAIEvent } from '#toolcrib';
   aiBus.openModal('delete-confirm', { itemId: row.id });
   aiBus.showToast('Item deleted', 'success');
   useAIEvent('modal:shown', (e) => { /* auto-cleanup */ });
   ```
   **The decision rule:** the event bus solves "how does component A tell component B something, when B isn't A's child and passing a prop isn't an option" — a `<Modal>` opened by id from anywhere, `<TabStrip>`/`<TabStrip.Panel>` as unrelated siblings with no shared parent, a toast triggered from a click handler nowhere near the toast viewport. It is **not** a general substitute for React Context or props between a component and its own direct descendants — `<SubmitButton>` reading `isSubmitting` from its ancestor `<Form>` via context is the correct tool already, precisely because that *is* a direct-tree relationship with no mount-order race to solve. Reach for the bus when there's a real cross-tree problem; reach for context/props when there isn't, even if the toolkit's aiBus is sitting right there and looks like it would "also work."
3. **NO Manual `useState` for Overlays.** `<Popup>`, `<Drawer>`, and `<Modal>` manage open/close state internally or via `aiBus`.
4. **Schema-Driven Forms.** Pass a Zod schema — controls bind via context automatically:
   ```tsx
   <Form schema={z.object({ email: z.string().email() })} onSubmit={save}>
     <FormField name="email" label="Email"><Input /></FormField>
     <SubmitButton>Save</SubmitButton>
   </Form>
   ```
5. **HSV Colour Space Only.** No RGB. All colours derive from CSS variables injected at `:root`.
6. **`layout="auto"` for Flex Filling.** Set `layout="auto"` on `<Card>` (and `<Card.Content>`) to enable flex-fill behaviour inside Splitters and other flex containers. This also activates automatic corner-squaring.
7. **NO `style`/`className` on Toolcrib Components — no exceptions. Stay in theme as hard as possible.** Toolcrib components are auto-themed: every visual decision they make comes from the theme, enforced by the type system, not just convention. When you need a different look, escalate in this order and stop at the first step that works: **(1)** the component's own props (`variant`, `size`, `subtheme`, `appearance`, ...); **(2)** `overrides`, on components that have a theme slice, for per-instance theme values (§10) — a component without one, like `<Block>`, exposes its theme choices as its own props, which is step 1; **(3)** a style domain — `<StyleDomainProvider subtheme="...">` to theme a whole subtree at once (§10); **(4)** composing themed primitives — `<Block>` for a themed surface (`background`/`padding`/`radius`/`border`/`subtheme`), `<Text>` for paragraph and inline text (`size`/`tone`/`weight`/`subtheme`, `as="p"|"span"`), `<VStack>`/`<HStack>`/`<Grid>` for layout and spacing; **(5)** changing the theme itself (a `ThemeProvider` parameter or theme-slice value), so the change applies consistently everywhere instead of in one spot. **(6) Only then** go off the board: a raw `<div>`/`<span>` with `style` — and even then, **its values come from the theme's CSS variables** (`var(--ai-bg-container)`, `var(--ai-padding-md)`, `var(--ai-radius-sm)`, `var(--ai-text-secondary)`, `rem` units), never literal hex colors or pixel values, with a short comment saying why steps 1–5 didn't cover it.
8. **Responsive Breakpoints — a fixed `sm`/`md`/`lg`/`xl` scale, global per theme setting, not per-instance classes.** `paddingMode`/`marginMode`/`cornerRadiusMode` on `<ThemeProvider initialParameters={{...}}>` each accept a `{ base, sm?, md?, lg?, xl? }` object in place of a plain mode string — `base` is the unconditional value (also what SSR/first paint uses), and each breakpoint key generates its own `@media (min-width: ...)` block:
   ```tsx
   <ThemeProvider initialParameters={{ paddingMode: { base: 'compact', md: 'normal', lg: 'spacious' } }}>
   ```
   This is a single, theme-wide setting — every component reading that mode responds to the same breakpoint config at once, unlike Tailwind's per-element `md:p-6`. It only covers density (padding/margin/radius) reflowing at a breakpoint, not structural responsiveness (a layout that needs a fundamentally different arrangement, not just denser/looser spacing) — reach for `<Grid columns="auto-fit">`'s own intrinsic `minmax()` reflow, or plain CSS media queries in your own app code, for that.

> **Content-Security-Policy note.** toolcrib works under a strict `style-src` (no `'unsafe-inline'`), confirmed by a real Playwright run enforcing an actual CSP header — not just reasoned about. Inline `style` objects — the vast majority of every component's styling — need nothing extra: React applies the `style` prop via direct CSSOM property assignment (`element.style.setProperty(...)`/`element.style[prop] = value`), never by writing a literal `style="..."` attribute string, and CSP's `style-src-attr` enforcement specifically hooks attribute mutation, not CSSOM property calls. The other half — the handful of dynamically-injected `<style>` *tags* (the typography base rule, responsive `@media` blocks, shared animation `@keyframes`, a few hover rules, all via `injectGlobalStyle`/`upsertGlobalStyle`) — is genuinely subject to `style-src-elem`, so it needs a nonce: pass it via `ToolcribProvider`'s `theme.nonce` option (or `ThemeProvider`'s own `nonce` prop directly) with the same value your server put in the `style-src` directive, and every `<style>` tag toolcrib creates carries it. Everything else about toolcrib is PWA/offline-friendly: zero runtime `fetch`/network calls anywhere in the vendored source, and `localStorage` usage (saved Theme Editor presets) is guarded to degrade safely rather than throw when storage is unavailable.

> **axe / accessibility-scanner note.** Overlays built on Base UI (toolcrib's primitives) render invisible focus-guard `<span>`s at the edges of a focus trap: `aria-hidden="true"`, `tabindex="0"`, marked `data-base-ui-focus-guard`. When focus lands on one, the trap moves it back inside the overlay immediately, so it never rests on a hidden element. axe-core's `aria-hidden-focus` rule can't see that redirect and reports every guard. Base UI's maintainers closed this as working as intended, citing W3C ACT rule 6cfa84, Passed Example 4. If your app runs axe (e.g. `@axe-core/playwright`), exclude just the guards rather than disabling the rule: `new AxeBuilder({ page }).exclude('[data-base-ui-focus-guard]')`. Everything else still gets `aria-hidden-focus` checking.

---

## 4. ⛔ Anti-Patterns — DO NOT Generate These

| ❌ Don't | ✅ Do Instead |
|:---|:---|
| Manually wire `<ThemeProvider>` + `<ToastProvider>` + `<ToastContainer>` at the app root | Use `<ToolcribProvider>` — composes all three in the correct order, so there's no separate `<ToastContainer>` to forget (see §1) |
| Manually manage overlay open/close with `useState`, create custom popup/modal/drawer components, or use `position: fixed` with manual z-index | Let `<Modal>`, `<Drawer>`, `<Popup>` manage state internally (or use `aiBus.openModal(id)`) — they portal correctly, handle focus traps/backdrop/light dismiss, and already use the `Z_INDEX` scale |
| Hardcode `z-index` values | Use the `Z_INDEX` scale: `import { Z_INDEX } from '#toolcrib'` |
| Use `px` units for spacing, borders, radii | Use `rem` values. Only `--ai-master-font-size` is in `px` |
| Hardcode colour values (hex, rgb) | Use CSS variables: `var(--ai-color-primary)`, `var(--ai-subtheme-error)` |
| Prop-drill callbacks through component trees | Use `aiBus.emit()` / `useAIEvent()` for cross-tree communication |
| Pass `style={{...}}` or `className="..."` to a toolcrib component | Use that component's `overrides` prop (§10) if it has theme-controlled axes; if what you need genuinely isn't one of them, a plain `<div>` is still fine — `<Block>` is the same escape hatch with theme-aware background/padding/radius/border defaults |
| Open an `<AlertDialog>`/`<Modal>` for a non-blocking message, or hand-roll a tinted `<div>` with an emoji and no `role` | Use `<Alert>` for a message that belongs next to its content (role `alert`/`status` announces it); `<AlertDialog>` only when the user must decide before continuing |
| Hand-roll a full-viewport app layout frame with header/sidebar/main regions and manual sidebar-collapse state | Use `<AppShell layout="sidebar-left"|"sidebar-right">` + `<AppShell.Sidebar>` — icon-only collapse and the correct divider border side come for free |
| Hand-roll a breadcrumb trail with manual truncation/overflow logic | Use `<Breadcrumb>` — collapses middle items into a `<DropdownMenu>` automatically once the trail overflows its container |
| Hand-roll month-grid calendar math (day-of-week offsets, leap years, month-length edge cases) | Use `<Calendar>` with `@internationalized/date` values — timezone/DST/locale correctness is exactly what that dependency exists to guarantee |
| Hand-roll swipe/drag physics, loop index math, or a `setInterval`-only slideshow for a slide viewport | Use `<Carousel>` — `embla-carousel-react` owns the drag/swipe/loop math; nav arrows and dot indicators are already themed and wired to it |
| N separate `<Checkbox>`es plus hand-written code to fold them into one array field | `<CheckboxGroup options={[...]} maxSelected={3} />` inside a `<FormField>`; the Form value is the array of checked values |
| Hand-roll a fuzzy-searchable command launcher with a raw `<input>` and manual filtering, or wire your own global `Cmd/Ctrl+K` listener | Use `<CommandPalette items={...}>` — filtering, grouping, and the global shortcut are wired in automatically once mounted; triggerable from anywhere via `aiBus.openCommandPalette(id)` |
| Fake per-row emphasis via `column.render` (styling each cell individually to approximate a highlighted row), or hand-roll row selection (a `Set` of ids in parent state, a checkbox column, header indeterminate logic) | Use `<DataTable rowSubtheme={(record) => ...}>` for row emphasis — classifies a row into `'error'`/`'success'`/`'warning'`/`'info'` and tints the actual row background/border, not a per-cell approximation — and `<DataTable selectable selectedKeys={...} onSelectionChange={...}>` for selection, where the checkbox column, 3-state header checkbox, and cross-page persistence all come built in |
| Hand-roll a date-field + calendar popover, or pass a raw JS `Date` into a custom date input | Use `<DatePicker>` with an `@internationalized/date` `CalendarDate` value — timezone/DST/locale correctness is exactly what that dependency exists to guarantee |
| Pair two `<DatePicker>`s for a date range and hand-validate that the end isn't before the start | Use `<DateRangePicker>` — one Form-bound `{ start, end }` value, with the calendar enforcing start/end ordering as you pick |
| Build a second horizontally-scrollable-strip-with-overflow-arrows implementation for a row of media thumbnails | Use `<Filmstrip>` — shares `<TabStrip>`'s own `useScrollOverflow` hook and active-indicator theming, not a parallel implementation that can drift from it |
| Write `register()` or `onChange` boilerplate for form fields | Nest `<Input>`, `<Select>`, etc. inside `<FormField name="...">` — binding is automatic |
| Build a second lazy-render/`IntersectionObserver` mechanism for a grid of many thumbnails | Use `<Gallery>` — thumbnails defer via the existing `<DeferredContent>`, not a new visibility mechanism |
| A hand-styled `<kbd>` or `<span>` per call site for a shortcut hint | `<Kbd>Esc</Kbd>`, or `<Kbd keys={['Ctrl', 'K']} />` for a combination |
| Hardcode a link's color (or leave it unthemed), or write `<a target="_blank">` without also setting `rel="noopener noreferrer"` (reverse-tabnabbing — the opened page gets `window.opener` and can navigate your tab) | Use `<Link>` — colors itself from `--ai-color-primary-readable`/`-secondary-readable` (hue preserved, contrast-checked) for link/visited state, and supplies the safe `rel` default automatically |
| `<Input type="number">` plus hand-rolled +/- buttons, clamping and `Intl.NumberFormat` display | `<NumberField min={0} max={99} formatOptions={{ style: 'currency', currency: 'USD' }} />` — inside a `<Form>` it stores a real `number` |
| A row of hand-rolled single-character `<input>`s with manual focus moving, paste splitting and keyboard handling | `<OTPField length={6} onComplete={verify} />` inside a `<FormField>`; the Form value is the code as one string |
| Hand-roll page-index math (clamping, prev/next, page-size resets) | Use `<Pagination>` — same controlled/uncontrolled `page`/`defaultPage`/`onPageChange` contract as `<DataTable>`'s own paging |
| Build a date range from two separate `<Calendar>`s with hand-written "end must be after start" logic | Use `<RangeCalendar>` (or `<DateRangePicker>` for a field + popover) — one grid, start/end ordering and keyboard range selection handled for you |
| Build a row of clickable star `<span>`s with manual hover/click state for a rating input | Use `<Rating>` — built on a Base UI radio group, inherits real keyboard operability and `aria-checked` semantics instead of approximating them |
| Hand-roll a left/right nav rail with a raw `<nav>`/`<ul>` and manual active-link state | Use `<Sidebar>` (inside `<AppShell.Sidebar>`) — active-item tracking and the correct icon-only collapsed rendering come for free |
| Hand-roll a pulsing/shimmering loading placeholder `<div>` for content that hasn't loaded yet | Use `<Skeleton shape="text"|"circle"|"rect">` — already animates off the shared keyframes, not a one-off duration |
| Hand-roll a spinning-border `<div>` for indeterminate loading | Use `<Spinner>` — already animates off the shared keyframes, not a one-off duration |
| When computing a pixel-exact `split` via `splitter:split_changed` (e.g. "collapse this panel to exactly its own header's height"), measuring an inner child's content box instead of the actual outermost element whose full rendered box (padding/border included) needs to fit | Measure the real outer element (e.g. a `Card.Header`, not the `<Toolbar>` inside it) with `getBoundingClientRect()`, and add half of `SPLITTER_HANDLE_SIZE_REM` (in px) before converting the target height to a percentage — both omissions clip the panel identically regardless of viewport size, confirmed directly via real Playwright measurement, not assumed |
| Hand-roll a multi-step wizard with `useState` for the active step and manual "can I advance" checks | Use `<Stepper>` — built on the same Base UI Tabs primitive as `<TabStrip>`, and blocks forward navigation past a step automatically once you set that step's `formId` |
| A raw `<p style={{ fontSize: '0.8125rem', color: 'var(--ai-text-secondary)' }}>` or a styled `<span>` for secondary text | `<Text size="sm" tone="secondary">`, or `<Text as="span" ...>` inline |
| Hand-roll a segmented time input (separate hour/minute/second `<input>`s with manual tab-order and validation) | Use `<TimeField>` with an `@internationalized/date` `Time` value — individually keyboard-editable segments come for free |
| Hand-roll a nested list's expand/collapse with `useState` per node, or a custom keydown handler for arrow-key navigation | Use `<Tree>` — full WAI-ARIA Treeview keyboard nav (arrows, Home/End, type-ahead) and `aria-expanded`/`aria-level`/`aria-selected` come for free |
| Build a bespoke fullscreen image lightbox, independent of `<Modal>` | Use `<Viewer>` — composes `<ViewerContent>` inside `<Modal>` automatically; nested inside another `<Modal>`, Escape closes only the `<Viewer>`, not the parent |
| Weld a media viewer's zoom/pan/nav content directly to one specific overlay component | Use `<ViewerContent>` on its own — zero overlay chrome of its own, host it inside `<Modal>` (`<Viewer>`), `<Drawer>`, `<Popup>`, or directly inline |

**Security note — URL-accepting props:** `Breadcrumb`, `Sidebar`, `Avatar`, `Gallery`, and `Viewer`/`ViewerContent` all render a caller-supplied `href`/`src` value as-is, exactly like a plain `<a href>`/`<img src>` — none of them validate or strip the URL scheme. If that value can ever originate from another user's input (a stored profile link, an uploaded file's URL) rather than your own static config, sanitize/allow-list the scheme yourself (reject `javascript:`, `data:`, etc.) before it reaches the prop. This is the same responsibility every `<a href>`/`<img src>` already carries in a plain React app, not something a toolcrib component does differently or is expected to guard for you.

---

## 5. Component Reference

Generated from `component-manifest.json` (`@manifestCategory`-grouped) — **Props** lists every prop name, not full types/defaults/descriptions; consult `component-manifest.json` or its per-category split under `ai-docs/manifest/` (see the callout above) for those. **Slots** are compound sub-components (`Card.Header`, etc.), `—` if none.

### Layout Primitives

Full prop detail: `ai-docs/manifest/layout-primitives.json`

| Component | Slots | Props | Description |
|:---|:---|:---|:---|
| `<AccessibleIcon>` | — | `label` | Adds a screen-reader-only accessible name to a decorative icon element |
| `<AspectRatio>` | — | `ratio` | Constrains content to a fixed width-to-height ratio |
| `<Block>` | — | `background`, `padding`, `paddingMode`, `radius`, `cornerRadiusMode`, `border`, `subtheme`, `appearance` | Themed surface `<div>`: background, padding, radius, border and subtheme colouring, all from theme tokens — no style/className, like every toolcrib component |
| `<Content>` | `.Grow` | `gap`, `marginMode`, `squareCorners` | Fills its container and establishes a flex-column layout domain for its children |
| `<Grid>` | — | `columns`, `minColWidth`, `gap`, `marginMode`, `paddingMode` | CSS Grid responsive multi-column layout |
| `<HStack>` | — | `gap`, `align`, `justify`, `paddingMode`, `marginMode`, `cornerRadiusMode`, `wrap` | Horizontal flex row layout primitive |
| `<Separator>` | — | `orientation`, `decorative`, `overrides` | Themed visual divider between content sections |
| `<Text>` | — | `as`, `size`, `tone`, `weight`, `mono`, `subtheme`, `variant`, `overrides`, `id`, `title`, `lang`, `dir` | Themed paragraph or inline text: size, tone, weight and status color from theme tokens, never literal styles |
| `<Toolbar>` | `.Left`, `.Center`, `.Right`, `.Button`, `.Separator` | `paddingMode`, `marginMode`, `cornerRadiusMode`, `orientation`, `overrides` | Horizontal action bar with left/center/right slot areas |
| `<UIGroup>` | — | `orientation`, `borderRadius` | Merges adjacent elements into a single visual compound control |
| `<VisuallyHidden>` | — | — | Hides content visually while keeping it announced to screen readers |
| `<VStack>` | — | `gap`, `align`, `justify`, `paddingMode`, `marginMode`, `cornerRadiusMode`, `wrap` | Vertical flex column layout primitive |

### Containers

Full prop detail: `ai-docs/manifest/containers.json`

| Component | Slots | Props | Description |
|:---|:---|:---|:---|
| `<Alert>` | `.Title`, `.Description` | `subtheme`, `variant`, `appearance`, `icon`, `role`, `action`, `onDismiss` | Inline callout (status icon, title, description, optional action and dismiss) with live-region semantics — in the page flow, never blocking |
| `<AppShell>` | `.Header`, `.Main`, `.Sidebar` | `layout`, `overrides` | Full-viewport root layout frame with Header, Sidebar, and Main slots — the top-level wrapper for an entire app |
| `<Card>` | `.Header`, `.Content`, `.Footer`, `.Actions` | `layout`, `squareCorners`, `overrides` | Slot-based container with automatic layout domain corner squaring |
| `<CardSimple>` | — | `title`, `subtitle`, `footer`, `actions` | Token-saving shorthand for simple cards without slot composition |
| `<Collapsible>` | — | `id`, `trigger`, `defaultOpen`, `isOpen`, `onOpenChange`, `disabled`, `overrides` | Single expand/collapse content panel — see Accordion for a data-driven set of panels |
| `<DeferredContent>` | — | `estimatedHeight`, `onVisibilityChange` | Defers layout/paint of off-screen content via native content-visibility, for long lists/grids of many repeated items (e.g. many <Card>s, a long <Accordion>) — not for flex `1 1 0px` fill panels like Splitter.Panel/TabStrip.Panel, which are already always-visible and get no benefit from this |
| `<ScrollArea>` | — | `orientation`, `type`, `maxHeight`, `overrides` | Scrollable container with a themed, cross-browser custom scrollbar |
| `<Sidebar>` | — | `items`, `activeId`, `onItemClick`, `collapsed`, `defaultCollapsed`, `onCollapsedChange`, `overrides`, `aria-label`, `aria-labelledby` | Vertical nav-item list built on Base UI NavigationMenu, with a collapsed icon-only mode |
| `<Splitter>` | `.Panel` | `id`, `orientation`, `initialSplit`, `minSize` | Resizable two-panel layout with automatic corner-squaring domain |

### Overlays

Full prop detail: `ai-docs/manifest/overlays.json`

| Component | Slots | Props | Description |
|:---|:---|:---|:---|
| `<AlertDialog>` | `.Header`, `.Body`, `.Footer`, `.Actions`, `.Cancel`, `.Action` | `id`, `trigger`, `isOpen`, `onOpenChange`, `width`, `zIndex`, `ariaLabel`, `overrides` | Blocking confirmation dialog that cannot be light-dismissed — for destructive/irreversible actions |
| `<CommandPalette>` | — | `id`, `items`, `filter`, `placeholder`, `emptyMessage`, `isOpen`, `onOpenChange`, `overrides` | Searchable command launcher opened via Cmd/Ctrl+K, hosted in a top-anchored Modal (VS Code-style quick-switcher placement); pluggable matcher for fuzzy search |
| `<ContextMenu>` | — | `id`, `items`, `overrides` | Right-click action menu, data-driven with separator support |
| `<Drawer>` | — | `id`, `trigger`, `position`, `isOpen`, `onOpenChange`, `title`, `width`, `zIndex` | Edge drawer overlay with backdrop blur and slide animation |
| `<DropdownMenu>` | — | `id`, `trigger`, `items`, `side`, `align`, `overrides` | Data-driven action menu with separator support |
| `<HoverCard>` | — | `id`, `content`, `side`, `align`, `openDelay`, `closeDelay`, `overrides` | Hover-triggered preview card for rich, interactive content |
| `<Modal>` | `.Header`, `.Body`, `.Footer`, `.Actions`, `.CloseButton` | `id`, `trigger`, `isOpen`, `onOpenChange`, `width`, `height`, `zIndex`, `ariaLabel`, `align`, `overrides` | Dialog overlay with focus trap, backdrop, and slot composition |
| `<Popup>` | `.Trigger` | `id`, `trigger`, `anchor`, `placement`, `isOpen`, `onOpenChange`, `zIndex`, `overrides` | Anchored popover with light dismiss and corner-squaring to trigger |
| `<Tooltip>` | — | `id`, `content`, `side`, `align`, `delayDuration`, `overrides` | Hover/focus tooltip wrapping a child trigger element |
| `<Viewer>` | — | `isOpen`, `onOpenChange` | Fullscreen media lightbox — composes ViewerContent inside Modal |
| `<ViewerContent>` | — | `id`, `items`, `activeIndex`, `defaultActiveIndex`, `onIndexChange`, `onClose`, `overrides` | Media viewer content — zoom/pan and prev/next navigation, no overlay chrome of its own; host it inside a `<Modal>` (see `<Viewer>`), `<Drawer>`, `<Popup>`, or directly inline, of your choosing |

### Data Display

Full prop detail: `ai-docs/manifest/data-display.json`

| Component | Slots | Props | Description |
|:---|:---|:---|:---|
| `<Accordion>` | — | `id`, `items`, `type`, `defaultValue`, `overrides` | Data-driven collapsible panel group with animations |
| `<Avatar>` | — | `src`, `alt`, `fallback`, `size`, `fallbackDelayMs`, `overrides` | User/entity avatar image with automatic initials fallback |
| `<Badge>` | — | `subtheme`, `variant`, `appearance`, `size`, `icon` | Small status/label pill with the same four semantic subthemes as `<Toast>`/`<DataTable rowSubtheme>`, plus identity-color `variant`s and `soft`/`solid`/`outline` appearances |
| `<BarChart>` | — | `categories`, `series`, `width`, `height`, `title`, `legendPosition`, `overrides` | Grouped vertical bar chart for categorical comparisons |
| `<Breadcrumb>` | `.Item`, `.Separator` | `separator`, `overrides` | Breadcrumb trail built on React Aria Components, collapsing middle items into a `<DropdownMenu>` on overflow |
| `<Carousel>` | — | `id`, `slides`, `loop`, `autoplay`, `onSlideChange`, `overrides` | Swipeable slide carousel with drag/loop physics via embla-carousel-react, plus themed nav arrows and dot indicators |
| `<DataTable>` | — | `id`, `data`, `columns`, `pagination`, `onEndReached`, `endReachedThreshold`, `defaultPageSize`, `pageSizeOptions`, `itemHeight`, `containerHeight`, `rowKey`, `rowSubtheme`, `onRowClick`, `quickFilter`, `quickFilterFields`, `quickFilterValue`, `defaultQuickFilterValue`, `onQuickFilterChange`, `sortBy`, `defaultSortBy`, `onSortChange`, `page`, `defaultPage`, `onPageChange`, `selectable`, `selectionMode`, `selectedKeys`, `defaultSelectedKeys`, `onSelectionChange`, `disableRowClickSelection`, `hideSelectionColumn`, `renderBulkActions`, `rowCommands`, `columnWidths`, `defaultColumnWidths`, `onColumnWidthsChange`, `overrides`, `densitySelector`, `density`, `defaultDensity`, `onDensityChange`, `csvExport`, `csvExportFileName`, `columnVisibility`, `hiddenColumns`, `defaultHiddenColumns`, `onHiddenColumnsChange`, `renderToolbarExtra`, `emptyState`, `editable`, `editSchema`, `editingKeys`, `defaultEditingKeys`, `onEditingKeysChange`, `onRowEditSave`, `onRowEditCancel`, `maxEditingRows` | Virtualized, sortable, paginated data table with sticky headers and real WAI-ARIA grid keyboard navigation |
| `<EmptyState>` | `.Icon`, `.Title`, `.Description`, `.Action` | — | Slot-based placeholder for an empty list/search/error state — same compositional pattern as `<Card>` |
| `<Filmstrip>` | — | `id`, `items`, `activeId`, `defaultActiveId`, `onChange`, `thumbnailSize`, `overrides` | Horizontally-scrollable thumbnail strip with an active-item indicator, reusing TabStrip's own overflow scroll detection |
| `<Gallery>` | — | `id`, `items`, `columns`, `onItemClick`, `overrides` | Thumbnail grid with lazy-rendered items, opening a fullscreen Viewer by default |
| `<Heatmap>` | — | `columns`, `rows`, `values`, `width`, `height`, `title`, `formatValue` | Row/column magnitude grid with a theme-tracking sequential ramp |
| `<Kbd>` | — | `keys`, `size`, `overrides`, `id`, `title` | Keyboard key or shortcut hint (`Esc`, `Ctrl` + `K`) as a themed key cap on a semantic `<kbd>` |
| `<LineChart>` | — | `categories`, `series`, `width`, `height`, `title`, `variant`, `legendPosition`, `overrides` | Multi-series line chart with a shared hover crosshair; `variant="area"` renders a stacked, filled area chart |
| `<Link>` | — | `variant`, `subtheme` | Themed hyperlink — colors itself from the theme's identity palette (hue-preserving, WCAG AA against the page background) for both unvisited and `:visited` state, and auto-applies `rel="noopener noreferrer"` when `target="_blank"` |
| `<Meter>` | — | `aria-label`, `value`, `min`, `max`, `low`, `high`, `optimum`, `label`, `showValue`, `format`, `size`, `subtheme` | Gauge for a value within a known range (role="meter"), with optional low/high/optimum colour bands |
| `<PieChart>` | — | `data`, `width`, `height`, `innerRadius`, `title`, `legendPosition` | Part-to-whole pie or donut chart |
| `<Progress>` | — | `id`, `aria-label`, `value`, `max`, `size`, `subtheme`, `overrides` | Determinate progress bar |
| `<ScaleLegend>` | — | `min`, `max`, `formatValue`, `width` | Gradient legend for a sequential (magnitude) color-encoded chart |
| `<Skeleton>` | — | `shape`, `width`, `height` | Shimmering loading placeholder in text/circle/rect shapes |
| `<Sparkline>` | — | `values`, `width`, `height`, `title` | Minimal inline trend line for a stat tile |
| `<Spinner>` | — | `size`, `subtheme` | Indeterminate circular loading indicator, same subtheme colouring as `<Progress>` |
| `<Stepper>` | — | `id`, `steps`, `activeIndex`, `defaultActiveIndex`, `onActiveIndexChange`, `overrides` | Linear step wizard built on the same Base UI Tabs primitive as `<TabStrip>`, with per-step Form validation gating |
| `<TabStrip>` | `.Tab`, `.Panel` | `id`, `items`, `activeId`, `defaultActiveId`, `onChange`, `overrides` | Scrollable tab header with filmstrip overflow. Use TabStrip.Panel for content |
| `<Tree>` | — | `id`, `items`, `expandedIds`, `defaultExpandedIds`, `onExpandedChange`, `selectedId`, `defaultSelectedId`, `onSelectChange`, `overrides` | Data-driven tree view with expand/collapse, single selection, and full WAI-ARIA Treeview keyboard navigation |

### Form Controls

Full prop detail: `ai-docs/manifest/form-controls.json`

| Component | Slots | Props | Description |
|:---|:---|:---|:---|
| `<Button>` | — | `variant`, `size`, `paddingMode`, `cornerRadiusMode`, `leadingIcon`, `trailingIcon`, `icon`, `subtheme`, `squareCorners`, `overrides` | Styled button with five variants, three sizes, subtheme colouring, and icon slots |
| `<Calendar>` | — | `name`, `value`, `defaultValue`, `onChange`, `minValue`, `maxValue`, `isDisabled`, `locale`, `overrides`, `size`, `aria-label`, `aria-labelledby` | Month grid for selecting a single date, built on React Aria Components |
| `<Checkbox>` | — | `name`, `label`, `checked`, `defaultChecked`, `onChange`, `overrides`, `squareCorners` | Boolean checkbox bound to Form context; `onChange` receives the new `boolean`; `ref` reaches the focusable checkbox element |
| `<CheckboxGroup>` | — | `name`, `options`, `value`, `defaultValue`, `onChange`, `maxSelected`, `label`, `aria-label`, `direction`, `disabled`, `size`, `overrides` | Group of checkboxes bound to one array-valued field (`string[]`), data-driven, with optional `maxSelected` |
| `<Combobox>` | — | `id`, `name`, `placeholder`, `ariaLabel`, `options`, `onSearch`, `searchDebounceMs`, `multiple`, `chipColor`, `value`, `defaultValue`, `onChange`, `allowCustomValue`, `disabled`, `noResultsMessage`, `overrides`, `size`, `squareCorners` | Filterable text input with a listbox, supporting client-side or async search and single/multi selection, bound to Form context |
| `<DatePicker>` | — | `name`, `label`, `value`, `defaultValue`, `onChange`, `minValue`, `maxValue`, `isDisabled`, `locale`, `overrides`, `size`, `aria-label`, `aria-labelledby`, `squareCorners` | Date field + calendar popover, hosted in `<Popup>` (not React Aria's own popover), built on React Aria Components |
| `<DateRangePicker>` | — | `name`, `label`, `value`, `defaultValue`, `onChange`, `minValue`, `maxValue`, `isDisabled`, `locale`, `overrides`, `size`, `aria-label`, `aria-labelledby`, `squareCorners` | Start/end date fields + a range calendar popover, hosted in `<Popup>`, built on React Aria Components |
| `<FileUpload>` | — | `name`, `accept`, `multiple`, `maxSizeBytes`, `maxFiles`, `disabled`, `onUpload`, `onFilesChange`, `overrides`, `size`, `squareCorners` | Drag-and-drop file picker with per-file progress and image thumbnails, bound to Form context |
| `<Form>` | — | `schema`, `initialValues`, `onSubmit`, `id` | Zod 4 schema-driven form. Controls bind via context — no register() or onChange boilerplate |
| `<FormError>` | — | `name` | Validation error display: one field's error (after it is touched) with `name`, or a summary banner of all errors without it |
| `<FormField>` | — | `name`, `label`, `helperText` | Wraps one form control with its label, helper text and validation error, and binds the control to the Form field `name` via context |
| `<Input>` | — | `name`, `cornerRadiusMode`, `overrides`, `squareCorners`, `size`, `clearable`, `onClear`, `leadingSection`, `trailingSection`, `revealable` | Text input bound to Form context, with optional leading/trailing sections (icon or affix text inside the border), a clear button, and a password reveal toggle |
| `<Label>` | — | `overrides` | Accessible label for a form control, associated via htmlFor or by wrapping it |
| `<Listbox>` | — | `id`, `options`, `activeIndex`, `selectedValues`, `onSelect`, `loading`, `loadingMessage`, `emptyMessage`, `multiSelectable`, `itemPadding`, `size`, `aria-label`, `aria-labelledby` | Keyboard-navigable, controlled option list — extracted from Combobox's own hand-built listbox, now usable standalone |
| `<NumberField>` | — | `name`, `label`, `value`, `defaultValue`, `onChange`, `min`, `max`, `step`, `formatOptions`, `locale`, `isDisabled`, `placeholder`, `size`, `aria-label`, `aria-labelledby`, `squareCorners` | Numeric input with −/+ steppers, min/max clamping, step snapping, arrow/PageUp/PageDown keys and locale-aware currency/percent/unit formatting, built on React Aria Components |
| `<OTPField>` | — | `name`, `length`, `value`, `defaultValue`, `onChange`, `onComplete`, `mode`, `mask`, `label`, `aria-label`, `disabled`, `size` | One-time code / PIN input: one cell per character with auto-advance, backspace-to-previous, paste distribution and SMS autofill (`autocomplete="one-time-code"`), bound to a Form as one string |
| `<Pagination>` | — | `id`, `totalItems`, `pageSize`, `page`, `defaultPage`, `onPageChange`, `size` | Page-number navigation control with Prev/Next, built on `<Button>` and shared page-index math with `<DataTable>` |
| `<RadioGroup>` | `.Option` | `name`, `value`, `defaultValue`, `onChange`, `options`, `direction`, `disabled`, `overrides`, `size` | Single-select radio control bound to Form context, data-driven or compositional |
| `<RangeCalendar>` | — | `name`, `value`, `defaultValue`, `onChange`, `minValue`, `maxValue`, `isDisabled`, `locale`, `overrides`, `size`, `aria-label`, `aria-labelledby` | Month grid for selecting an inclusive range of dates (click the start, then the end), built on React Aria Components |
| `<RangeSlider>` | — | `id`, `name`, `value`, `defaultValue`, `min`, `max`, `step`, `minStepsBetweenThumbs`, `onChange`, `disabled`, `commitOnRelease`, `ariaLabel`, `thumbLabels`, `overrides` | Two-thumb range control (lower/upper bound) built on Base UI Slider, styled identically to Slider |
| `<Rating>` | — | `name`, `aria-label`, `value`, `defaultValue`, `onChange`, `max`, `icon`, `readOnly`, `overrides` | Star rating control built on a Base UI radio group, or a read-only fractional-fill display |
| `<Select>` | — | `id`, `name`, `placeholder`, `aria-label`, `options`, `value`, `defaultValue`, `onChange`, `disabled`, `overrides`, `size`, `squareCorners` | Dropdown select control bound to Form context: a select-only combobox over the toolkit's own Listbox |
| `<Slider>` | — | `id`, `name`, `value`, `defaultValue`, `min`, `max`, `step`, `onChange`, `disabled`, `commitOnRelease`, `ariaLabel`, `overrides` | Range input control built on Base UI Slider |
| `<SubmitButton>` | — | `variant`, `size`, `paddingMode`, `cornerRadiusMode`, `leadingIcon`, `trailingIcon`, `icon`, `subtheme`, `squareCorners`, `overrides` | `<Button type="submit">` that stays disabled while the enclosing Form is submitting; takes every Button prop, `ref` included |
| `<Switch>` | — | `name`, `label`, `checked`, `defaultChecked`, `onChange`, `overrides`, `squareCorners` | Boolean on/off switch with a sliding track, bound to Form context; `onChange` receives the new `boolean`; `ref` reaches the focusable switch element |
| `<Textarea>` | — | `name`, `cornerRadiusMode`, `overrides`, `size` | Multi-line text input bound to Form context, sized and themed like Input |
| `<ThemeEditor>` | — | `themeManagement`, `themeManagementSlot` | Real-time HSV theme editor content — no overlay chrome of its own;
host it inside a `<Drawer>` (or `<Modal>`/`<Popup>`) of your choosing. |
| `<TimeField>` | — | `name`, `label`, `value`, `defaultValue`, `onChange`, `granularity`, `hourCycle`, `isDisabled`, `locale`, `size`, `aria-label`, `aria-labelledby`, `squareCorners` | Segmented time input (hour/minute/second, individually keyboard-editable) built on React Aria Components |
| `<Toggle>` | — | `name`, `pressed`, `defaultPressed`, `onPressedChange`, `disabled`, `overrides`, `size` | Two-state pressed/unpressed button, standalone (see ToggleGroup for a connected set) |
| `<ToggleGroup>` | — | `name`, `type`, `value`, `defaultValue`, `onChange`, `options`, `disabled`, `overrides`, `size`, `squareCorners`, `aria-label` | Connected button set for single or multiple selection, data-driven |

`<Modal ariaLabel>` and `<Drawer title>` are **not** the same kind of prop: `Modal.ariaLabel` is a screen-reader-only string (`Modal.Header`'s visible text is decorative and not otherwise wired to the dialog's accessible name), while `Drawer.title` is a visible `ReactNode` rendered in the drawer header. Don't assume one works like the other.

### Toast Subsystem

Requires `<ToastProvider>` + `<ToastContainer>` at the root (see §1).

```tsx
// Simple: one-liner
aiBus.showToast('Saved successfully', 'success');

// Advanced: with actions, sticky, custom anchor
const { addToast } = useToastActions();
addToast({
  type: 'error',
  message: 'Connection lost',
  sticky: true,
  actions: [{ label: 'Retry', onClick: reconnect }],
  anchor: 'bottom-center',
});
```

Use `useToastActions()` (`addToast`, `dismissToast`, `clearAll`, `setAnchor`) in any component that only *fires* toasts: its value is stable. `useToast()` also returns the live `toasts` list and current `anchor`, so its consumers re-render every time any toast is added or expires. Reserve it for components that actually render or read those.

### Theme Editor

```tsx
<ThemeEditor trigger={<Button variant="ghost" icon="🎨">Theme</Button>} />
```

---

## 6. `layout="auto"` — Fill & Corner-Squaring

When a `<Card>` is placed inside a flex container (like a `<Splitter>` panel), set `layout="auto"` to make it fill available space and automatically square its corners adjacent to the splitter handle:

```tsx
<Splitter orientation="vertical" initialSplit={70}>
  <Splitter.Panel>
    <Card layout="auto">
      <Card.Header>Top Panel</Card.Header>
      <Card.Content layout="auto">{/* scrollable content */}</Card.Content>
    </Card>
  </Splitter.Panel>
  <Splitter.Panel>
    <Card layout="auto">
      <Card.Header>Bottom Panel</Card.Header>
      <Card.Content layout="auto">{/* content */}</Card.Content>
    </Card>
  </Splitter.Panel>
</Splitter>
```

- `layout="auto"` on Card → sets `height:100%`, `flex:1`, `minHeight:0`
- `layout="auto"` on Card.Content → enables overflow scrolling within flex layout
- Corner-squaring is handled automatically by the layout domain context

---

## 7. Z-Index Scale

**Always import `Z_INDEX` from `#toolcrib`.** Never hardcode z-index values.

| Tier | Value | Used By |
|:---:|:---:|:---|
| `BASE` | 0 | Cards, Grids, Stacks, Accordion |
| `STICKY` | 10 | DataTable headers, sticky Toolbars |
| `SPLITTER` | 20 | Splitter resize handles |
| `DRAWER` | 100 | Drawer panels, Theme Editor |
| `MODAL` | 200 | Modal dialogs |
| `DROPDOWN` | 300 | Select dropdowns, Popup, DropdownMenu |
| `TOOLTIP` | 400 | Tooltip overlays |
| `TOAST` | 500 | Toast notifications |

---

## 8. CSS Variable Theme System (HSV-Derived)

All colours are controlled by CSS variables injected at `:root` by `<ThemeProvider>`:

### Palette Variables
- `--ai-color-base` — The base HSV colour
- `--ai-color-primary`, `--ai-color-secondary`, `--ai-color-accent` — Harmony-derived
- `--ai-bg-primary`, `--ai-bg-surface`, `--ai-bg-container` — Background surfaces
- `--ai-text-primary`, `--ai-text-secondary` — Text colours
- `--ai-border`, `--ai-focus-ring` — Borders and focus indicators

### Subtheme Variables
- `--ai-subtheme-error`, `--ai-subtheme-success`, `--ai-subtheme-warning`, `--ai-subtheme-info`
- Each has `-bg`, `-border`, `-text` variants

### Spacing & Shape Variables
- `--ai-padding-*`, `--ai-margin-*`, `--ai-radius-*`, `--ai-shadow-*`
- `--ai-transition-normal`, `--ai-transition-duration-normal`, `--ai-transition-easing`

The full list (96 variables and counting) lives in `component-manifest.json`'s `themeSystem.cssVariables` — consult it rather than guessing a name.

---

## 9. Theme Slices

The theme system is extensible via **slices**. Each slice provides:
- A state interface
- CSS variable generation from that state
- An optional editor control for the Theme Editor

Built-in slices: `padding`, `margin`, `radius`, `shadow`, `table`, `animation`, `tab`, `drawer`, `accordion`, `card`, `tooltip`, `button`, `input`, `togglecontrol`, `select`, `radiogroup`, `slider`, `modal`, `alertdialog`, `popup`, `toast`, `dropdownmenu`, `contextmenu`, `progress`, `separator`, `avatar`, `toggle`, `collapsible`, `uigroup`, `toolbar`, `appshell`, `typography`, `tree`, `rating`, `sidebar`, `stepper`, `datepicker`, `breadcrumb`, `carousel`, `combobox`, `commandpalette`, `fileUpload`, `gallery`, `hoverCard`, `label`, `scrollArea`, `viewer`, `chart`, `livingColor`, `text`, `kbd`.

Register custom slices:
```tsx
import { globalThemeSliceRegistry, ThemeSlice } from '#toolcrib';

const MySlice: ThemeSlice<{ size: number }> = {
  id: 'my-slice',
  name: 'My Custom Slice',
  defaultState: { size: 16 },
  getCSSVariables: (state) => ({ '--my-size': `${state.size}rem` }),
  renderEditorControl: (state, onChange) => (
    <Slider value={state.size} min={8} max={32} onChange={v => onChange({ size: v })} />
  ),
};
globalThemeSliceRegistry.register(MySlice);
```

---

## 10. Per-Instance Overrides & Style Domains

A component with theme-controlled visual axes exposes them through an `overrides` prop instead of `style` — a typed, sparse patch applied only to that one instance, layered on top of (never replacing) the global Theme Editor state:

```tsx
<Card overrides={{ padding: 'compact', headerStyle: 'subtle-bg' }}>
  <Card.Header>Compact Card</Card.Header>
  <Card.Content>Only this Card gets these values — every other Card, and the
  global Theme Editor's Card slice, is untouched.</Card.Content>
</Card>
```

Not every component has an `overrides` prop — only ones with a registered theme slice (Card, TabStrip, Accordion, Tooltip, DataTable) or explicit theme-controlled fields (Button's `subtheme`). A component with nothing theme-controlled beyond structural props (children, callbacks, `id`) simply has none to expose.

**Subtheme** (`'error' | 'success' | 'warning' | 'info'`) resolves the same way wherever a component supports it: `overrides.subtheme` (or `subtheme` directly on components like `Button` that don't have a full `overrides` object) wins if set; otherwise it falls back to the nearest ancestor `<StyleDomainProvider>`:

```tsx
import { StyleDomainProvider } from '#toolcrib';

<StyleDomainProvider subtheme="error">
  {/* Every subtheme-aware component in here defaults to the error
      treatment without setting subtheme itself — e.g. a validation
      section you want visually flagged as a whole. */}
  <Card>
    <Card.Header>Validation Failed</Card.Header>
    <Card.Content>...</Card.Content>
  </Card>
</StyleDomainProvider>
```

This is Context-based on purpose, not CSS-variable inheritance — `<Modal>`, `<Popup>`, and `<Drawer>` all render their content through a portal elsewhere in the DOM, and `<StyleDomainProvider>` still reaches them correctly because it follows the component tree, not DOM position.

If neither `overrides` nor a style domain covers what you need on a specific component, that's a real, intentional boundary on that component — the toolkit trades some flexibility for keeping visual decisions theme-driven and AI-legible. Work down principle 7's ladder (§3) before leaving the theme: a themed primitive (`<Block>`, `<Text>`, `<VStack>`/`<HStack>`/`<Grid>`) or a theme-level change usually covers it. A raw `<div>`/`<span>` with `style` is the last resort, not a shortcut — and its `style` still reads the theme's CSS variables (§8) rather than hardcoding values, so it keeps following the Theme Editor, dark mode and subthemes like everything around it.

---

## 11. Event Bus — Complete Payload Reference

Most events are fire-and-forget: a subscriber only sees them from the moment it calls `useAIEvent`/`aiBus.on` onward. A few events (currently `tab:changed`) are **sticky** — the bus remembers the last payload per discriminator (its `id` field) and replays it immediately to a new subscriber, so a late-mounting listener still learns the current state instead of only future changes. This matters for components with no shared DOM ancestor or mount-order guarantee, like `<TabStrip>` and `<TabStrip.Panel>`.

Rendered in [TOON](https://github.com/toon-format/spec) form (`[count]{keys}:` header, one indented row per entry) — more token-compact than a Markdown table for a strongly-typed AI reader, and generated directly from `eventBus.channels` in `component-manifest.json` so it can't drift from it:

```
[86]{name,payload}:
  "theme:changed","{ parameters: ThemeParameters; palette: GeneratedPalette; cssVariables: Record<string, string>; }"
  "element:resized","{ id?: string; target: HTMLElement; width: number; height: number; contentHeight: number }"
  "element:intersected","{ id?: string; target: HTMLElement; isIntersecting: boolean; ratio: number }"
  "element:mutated","{ id?: string; target: Node; type: MutationRecordType; attributeName: string | null; oldValue: string | null }"
  "viewport:resized","{ width: number; height: number }"
  "popup:shown","{ id: string; targetId?: string; data?: any }"
  "popup:hidden","{ id: string }"
  "drawer:shown","{ id: string; position?: 'top' | 'right' | 'bottom' | 'left'; data?: any }"
  "drawer:hidden","{ id: string }"
  "modal:shown","{ id: string; data?: any }"
  "modal:hidden","{ id: string }"
  "alertdialog:shown","{ id: string; data?: any }"
  "alertdialog:hidden","{ id: string }"
  "collapsible:opened","{ id?: string }"
  "collapsible:closed","{ id?: string }"
  "form:submitted","{ formId?: string; values: Record<string, any> }"
  "form:validated","{ formId?: string; isValid: boolean }"
  "form:errored","{ formId?: string; errors: Record<string, string> }"
  "toast:shown","{ id: string; type: SubthemeName; message: string; priority?: 'low' | 'medium' | 'high' | 'urgent'; loading?: boolean }"
  "toast:updated","{ id: string; type: SubthemeName; message: string; loading?: boolean }"
  "toast:added","{ id: string; type: SubthemeName; message: string; priority?: 'low' | 'medium' | 'high' | 'urgent'; loading?: boolean }"
  "toast:expired","{ id: string; message?: string; type?: string }"
  "toast:dismissed","{ id: string; message?: string; type?: string; reason?: 'user' | 'expired' | 'action' }"
  "toast:action_clicked","{ id: string; actionLabel: string; message?: string }"
  "error:boundary","{ componentName: string; error: string; stack?: string }"
  "tooltip:shown","{ id?: string; content: string }"
  "tooltip:hidden","{ id?: string }"
  "hovercard:shown","{ id?: string }"
  "hovercard:hidden","{ id?: string }"
  "accordion:opened","{ id?: string; itemValue: string }"
  "accordion:closed","{ id?: string; itemValue: string }"
  "tree:expanded","{ id?: string; itemId: string }"
  "tree:collapsed","{ id?: string; itemId: string }"
  "menu:opened","{ id?: string }"
  "menu:closed","{ id?: string }"
  "menu:item_selected","{ id?: string; itemValue: string }"
  "commandpalette:open","{ id?: string }"
  "commandpalette:shown","{ id?: string }"
  "commandpalette:hidden","{ id?: string }"
  "commandpalette:item_selected","{ id?: string; itemValue: string }"
  "select:changed","{ name?: string; value: string }"
  "combobox:changed","{ name?: string; value: string | string[] }"
  "fileupload:changed","{ name?: string; fileCount: number }"
  "slider:changed","{ name?: string; value: number }"
  "rangeslider:changed","{ name?: string; value: [number, number] }"
  "toggle:changed","{ name?: string; pressed: boolean }"
  "rating:changed","{ name?: string; value: number }"
  "datepicker:changed","{ name?: string; value: string | null }"
  "calendar:changed","{ name?: string; value: string | null }"
  "daterangepicker:changed","{ name?: string; value: { start: string; end: string } | null }"
  "rangecalendar:changed","{ name?: string; value: { start: string; end: string } }"
  "alert:dismissed","{ id?: string; subtheme?: string }"
  "timefield:changed","{ name?: string; value: string | null }"
  "numberfield:changed","{ name?: string; value: number | null }"
  "checkboxgroup:changed","{ name?: string; value: string[] }"
  "otpfield:changed","{ name?: string; value: string; complete: boolean }"
  "togglegroup:changed","{ name?: string; value: string | string[] }"
  "progress:changed","{ id?: string; value: number; max: number }"
  "carousel:changed","{ id?: string; activeIndex: number; previousIndex?: number }"
  "tab:changed","{ id?: string; activeId: string; previousId?: string }"
  "filmstrip:changed","{ id?: string; activeId: string; previousId?: string }"
  "viewer:item_changed","{ id?: string; activeIndex: number }"
  "viewer:shown","{ id?: string }"
  "viewer:hidden","{ id?: string }"
  "stepper:changed","{ id?: string; activeIndex: number; previousIndex?: number }"
  "datatable:sorted","{ id?: string; sortBy: { key: string; direction: 'asc' | 'desc' }[] }"
  "datatable:filtered","{ id?: string; value: string; matchCount: number }"
  "datatable:paginated","{ id?: string; page: number; pageSize: number }"
  "datatable:selection_changed","{ id?: string; selectedKeys: string[] }"
  "pagination:changed","{ id?: string; page: number; pageSize: number }"
  "datatable:row_clicked","{ id?: string; index: number }"
  "datatable:row_command","{ id?: string; command: string; key: string; index: number }"
  "datatable:density_changed","{ id?: string; density: 'compact' | 'normal' | 'spacious' }"
  "datatable:end_reached","{ id?: string; loadedCount: number }"
  "datatable:exported","{ id?: string; rowCount: number }"
  "datatable:columns_changed","{ id?: string; hiddenColumns: string[] }"
  "datatable:row_edit_started","{ id?: string; key: string; index: number }"
  "datatable:row_edit_saved","{ id?: string; key: string; index: number; values: unknown }"
  "datatable:row_edit_cancelled","{ id?: string; key: string; index: number }"
  "log:cleared","{ timestamp: string }"
  "route:navigate","{ to: string }"
  "auth:unauthorized","{ reason?: string }"
  "locale:changed","{ strings: ToolcribLocaleStrings }"
  "layout:domain:created","{ domainId: string; parentId: string; orientation: 'horizontal' | 'vertical' }"
  "splitter:split_changed","{ id: string; split: number }"
  "layout:corners:squared","{ domainId: string; slot: 'first' | 'second'; orientation: 'horizontal' | 'vertical'; squaredCorners: { topLeft?: boolean; topRight?: boolean; bottomLeft?: boolean; bottomRight?: boolean; }; }"
```

Notable payloads:
- `error:boundary` — emitted by `<AIErrorBoundary>` (used internally by `<Modal>`/`<Drawer>`) whenever a child throws during render
- `tab:changed` — `id` is the `<TabStrip id>` group identifier; sticky (see above), so a `<TabStrip.Panel>` mounted after this fires still gets the current value replayed to it
- `route:navigate` — a one-shot imperative navigation command, deliberately not sticky; forwarded to a real router via `<RouterAdapterProvider>`/`useRouterBridge()` — see the router-integration example

