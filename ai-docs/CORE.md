# Toolcrib — Core Reference & System Prompt

`toolcrib` is a React component library designed specifically for AI code generation ("vibe coding"). It provides structural UI components, slot-based composition without prop-drilling, a strongly-typed Event Bus, a Zod 4 form validation engine, and an HSV-based CSS variable theme system.

**Always include this file's content in your system instructions** (Cursor `.cursorrules`, `AGENTS.md`, `CLAUDE.md`, Custom GPTs) when working in a project that uses `toolcrib`. In addition to this file, also include exactly one of:
- **`NEW_APP.md`** — starting a project from scratch with `toolcrib` as the UI layer from day one.
- **`REFACTOR_APP.md`** — introducing `toolcrib` into a codebase that already has UI, styling, and state management.

If the codebase (or the person driving the session) already thinks in Tailwind's utility-class vocabulary specifically, also read `TAILWIND.md` — a short vocabulary lookup, not a third required document.

> **Two documents, two different jobs — load both.** This file is the source of truth for **rules, conventions, and behavior**: what's forbidden, why, and how the pieces fit together. **`component-manifest.json`** is the source of truth for **exact, enumerable data**: every component's full prop list with types/defaults/required flags, the complete `--ai-*` CSS variable list, the full event-channel/payload table, and the z-index scale. It's generated directly from source (`scripts/generate-manifest.js`) and kept in sync by a CI check — so it cannot go stale the way hand-maintained prose can. Where this file gives you a short pointer instead of a full table, that's intentional: **consult the manifest, don't guess or recall from memory.**

> **Reading strategy for the Component Reference (§4) and the manifest.** §4's table already gives you every component's name, slots, and prop *names* — enough to pick the right component and call it correctly by convention. Read `component-manifest.json` (or its per-category split, next) only when §4 doesn't tell you enough: exact prop types, `@default` values, `required` flags, or slot-prop shapes. When you do, prefer the split file under `ai-docs/manifest/<category-slug>.json` for the category you're working in (e.g. `ai-docs/manifest/data-display.json` for `<DataTable>`) — same content as that category in `component-manifest.json`, a fraction of the size. `component-manifest.json` itself remains the single source of truth for the non-component-specific data (`themeSystem`, `zIndexScale`, `eventBus`) and for anything spanning more than one category at once. Worked examples for mechanisms with no prior in ordinary React/Radix training data — `overrides`+`StyleDomain` composition, the event bus's sticky-replay semantics, the z-index scale — live under `ai-docs/examples/`; read the relevant one before touching one of those mechanisms for the first time in a session.

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

`aiBus.requireAuth(reason?)` announces that the current session/request is unauthorized (an API 401, a token expiry) from wherever that check actually happens, without prop-drilling a callback down to it — a persistently-mounted listener elsewhere in the tree decides what "unauthorized" means for your app. See `ai-docs/examples/auth-unauthorized.md`. `aiBus.on('*', ...)` (the wildcard subscriber every event already passes through) is the same shape of mechanism generalized to forwarding toolcrib's whole event vocabulary to an analytics/telemetry pipeline — see `ai-docs/examples/wildcard-event-monitoring.md`.

---

## 2. Core Principles

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
7. **NO `style`/`className` on Toolcrib Components — one deliberate exception.** No component in this toolkit accepts either prop, enforced by the type system, not just convention — use `overrides` for per-instance theme control (§9) instead of ad hoc inline styles. The one exception is `<Block>`: a themed, stylable `<div>` for ad-hoc container/layout needs no curated component's own prop surface covers — its own `background`/`padding`/`radius`/`border` props default to theme CSS variables, so it doesn't fall back to un-themed raw styling. This doesn't preclude a genuinely plain `<div>` either — `style`/`className` always work normally on your own plain HTML elements (`<div>`, `<span>`, ...), theme-aware or not; `<Block>` is there for when the theme-aware defaults are actually what you want, not a replacement for every raw `<div>`. The restriction in this principle is specifically every other toolkit component's own API surface.
8. **Responsive Breakpoints — a fixed `sm`/`md`/`lg`/`xl` scale, global per theme setting, not per-instance classes.** `paddingMode`/`marginMode`/`cornerRadiusMode` on `<ThemeProvider initialParameters={{...}}>` each accept a `{ base, sm?, md?, lg?, xl? }` object in place of a plain mode string — `base` is the unconditional value (also what SSR/first paint uses), and each breakpoint key generates its own `@media (min-width: ...)` block:
   ```tsx
   <ThemeProvider initialParameters={{ paddingMode: { base: 'compact', md: 'normal', lg: 'spacious' } }}>
   ```
   This is a single, theme-wide setting — every component reading that mode responds to the same breakpoint config at once, unlike Tailwind's per-element `md:p-6`. It only covers density (padding/margin/radius) reflowing at a breakpoint, not structural responsiveness (a layout that needs a fundamentally different arrangement, not just denser/looser spacing) — reach for `<Grid columns="auto-fit">`'s own intrinsic `minmax()` reflow, or plain CSS media queries in your own app code, for that.

> **Content-Security-Policy note.** toolcrib works under a strict `style-src` (no `'unsafe-inline'`), confirmed by a real Playwright run enforcing an actual CSP header — not just reasoned about. Inline `style` objects — the vast majority of every component's styling — need nothing extra: React applies the `style` prop via direct CSSOM property assignment (`element.style.setProperty(...)`/`element.style[prop] = value`), never by writing a literal `style="..."` attribute string, and CSP's `style-src-attr` enforcement specifically hooks attribute mutation, not CSSOM property calls. The other half — the handful of dynamically-injected `<style>` *tags* (the typography base rule, responsive `@media` blocks, shared animation `@keyframes`, a few hover rules, all via `injectGlobalStyle`/`upsertGlobalStyle`) — is genuinely subject to `style-src-elem`, so it needs a nonce: pass it via `ToolcribProvider`'s `theme.nonce` option (or `ThemeProvider`'s own `nonce` prop directly) with the same value your server put in the `style-src` directive, and every `<style>` tag toolcrib creates carries it. Everything else about toolcrib is PWA/offline-friendly: zero runtime `fetch`/network calls anywhere in the vendored source, and `localStorage` usage (saved Theme Editor presets) is guarded to degrade safely rather than throw when storage is unavailable.

---

## 3. ⛔ Anti-Patterns — DO NOT Generate These

| ❌ Don't | ✅ Do Instead |
|:---|:---|
| Manually wire `<ThemeProvider>` + `<ToastProvider>` + `<ToastContainer>` at the app root | Use `<ToolcribProvider>` — composes all three in the correct order, so there's no separate `<ToastContainer>` to forget (see §1) |
| Manually manage overlay open/close with `useState`, create custom popup/modal/drawer components, or use `position: fixed` with manual z-index | Let `<Modal>`, `<Drawer>`, `<Popup>` manage state internally (or use `aiBus.openModal(id)`) — they portal correctly, handle focus traps/backdrop/light dismiss, and already use the `Z_INDEX` scale |
| Hardcode `z-index` values | Use the `Z_INDEX` scale: `import { Z_INDEX } from '#toolcrib'` |
| Use `px` units for spacing, borders, radii | Use `rem` values. Only `--ai-master-font-size` is in `px` |
| Hardcode colour values (hex, rgb) | Use CSS variables: `var(--ai-color-primary)`, `var(--ai-subtheme-error)` |
| Prop-drill callbacks through component trees | Use `aiBus.emit()` / `useAIEvent()` for cross-tree communication |
| Pass `style={{...}}` or `className="..."` to a toolcrib component | Use that component's `overrides` prop (§9) if it has theme-controlled axes; if what you need genuinely isn't one of them, a plain `<div>` is still fine — `<Block>` is the same escape hatch with theme-aware background/padding/radius/border defaults |
| Hand-roll a full-viewport app layout frame with header/sidebar/main regions and manual sidebar-collapse state | Use `<AppShell layout="sidebar-left"|"sidebar-right">` + `<AppShell.Sidebar>` — icon-only collapse and the correct divider border side come for free |
| Hand-roll a breadcrumb trail with manual truncation/overflow logic | Use `<Breadcrumb>` — collapses middle items into a `<DropdownMenu>` automatically once the trail overflows its container |
| Hand-roll month-grid calendar math (day-of-week offsets, leap years, month-length edge cases) | Use `<Calendar>` with `@internationalized/date` values — timezone/DST/locale correctness is exactly what that dependency exists to guarantee |
| Hand-roll swipe/drag physics, loop index math, or a `setInterval`-only slideshow for a slide viewport | Use `<Carousel>` — `embla-carousel-react` owns the drag/swipe/loop math; nav arrows and dot indicators are already themed and wired to it |
| Hand-roll a fuzzy-searchable command launcher with a raw `<input>` and manual filtering, or wire your own global `Cmd/Ctrl+K` listener | Use `<CommandPalette items={...}>` — fuzzy filter, grouping, and the global shortcut are wired in automatically once mounted; triggerable from anywhere via `aiBus.openCommandPalette(id)` |
| Fake per-row emphasis via `column.render` (styling each cell individually to approximate a highlighted row), or hand-roll row selection (a `Set` of ids in parent state, a checkbox column, header indeterminate logic) | Use `<DataTable rowSubtheme={(record) => ...}>` for row emphasis — classifies a row into `'error'`/`'success'`/`'warning'`/`'info'` and tints the actual row background/border, not a per-cell approximation — and `<DataTable selectable selectedKeys={...} onSelectionChange={...}>` for selection, where the checkbox column, 3-state header checkbox, and cross-page persistence all come built in |
| Hand-roll a date-field + calendar popover, or pass a raw JS `Date` into a custom date input | Use `<DatePicker>` with an `@internationalized/date` `CalendarDate` value — timezone/DST/locale correctness is exactly what that dependency exists to guarantee |
| Build a second horizontally-scrollable-strip-with-overflow-arrows implementation for a row of media thumbnails | Use `<Filmstrip>` — shares `<TabStrip>`'s own `useScrollOverflow` hook and active-indicator theming, not a parallel implementation that can drift from it |
| Write `register()` or `onChange` boilerplate for form fields | Nest `<Input>`, `<Select>`, etc. inside `<FormField name="...">` — binding is automatic |
| Build a second lazy-render/`IntersectionObserver` mechanism for a grid of many thumbnails | Use `<Gallery>` — thumbnails defer via the existing `<DeferredContent>`, not a new visibility mechanism |
| Hand-roll page-index math (clamping, prev/next, page-size resets) | Use `<Pagination>` — same controlled/uncontrolled `page`/`defaultPage`/`onPageChange` contract as `<DataTable>`'s own paging |
| Build a row of clickable star `<span>`s with manual hover/click state for a rating input | Use `<Rating>` — built on Radix `RadioGroup`, inherits real keyboard operability and `aria-checked` semantics instead of approximating them |
| Hand-roll a left/right nav rail with a raw `<nav>`/`<ul>` and manual active-link state | Use `<Sidebar>` (inside `<AppShell.Sidebar>`) — active-item tracking and the correct icon-only collapsed rendering come for free |
| Hand-roll a pulsing/shimmering loading placeholder `<div>` for content that hasn't loaded yet | Use `<Skeleton shape="text"|"circle"|"rect">` — already animates off the shared keyframes, not a one-off duration |
| Hand-roll a spinning-border `<div>` for indeterminate loading | Use `<Spinner>` — already animates off the shared keyframes, not a one-off duration |
| Hand-roll a multi-step wizard with `useState` for the active step and manual "can I advance" checks | Use `<Stepper>` — built on the same Radix Tabs primitive as `<TabStrip>`, and blocks forward navigation past a step automatically once you set that step's `formId` |
| Hand-roll a segmented time input (separate hour/minute/second `<input>`s with manual tab-order and validation) | Use `<TimeField>` with an `@internationalized/date` `Time` value — individually keyboard-editable segments come for free |
| Hand-roll a nested list's expand/collapse with `useState` per node, or a custom keydown handler for arrow-key navigation | Use `<Tree>` — full WAI-ARIA Treeview keyboard nav (arrows, Home/End, type-ahead) and `aria-expanded`/`aria-level`/`aria-selected` come for free |
| Build a bespoke fullscreen image lightbox, independent of `<Modal>` | Use `<Viewer>` — composes `<ViewerContent>` inside `<Modal>` automatically; nested inside another `<Modal>`, Escape closes only the `<Viewer>`, not the parent |
| Weld a media viewer's zoom/pan/nav content directly to one specific overlay component | Use `<ViewerContent>` on its own — zero overlay chrome of its own, host it inside `<Modal>` (`<Viewer>`), `<Drawer>`, `<Popup>`, or directly inline |

**Security note — URL-accepting props:** `Breadcrumb`, `Sidebar`, `Avatar`, `Gallery`, and `Viewer`/`ViewerContent` all render a caller-supplied `href`/`src` value as-is, exactly like a plain `<a href>`/`<img src>` — none of them validate or strip the URL scheme. If that value can ever originate from another user's input (a stored profile link, an uploaded file's URL) rather than your own static config, sanitize/allow-list the scheme yourself (reject `javascript:`, `data:`, etc.) before it reaches the prop. This is the same responsibility every `<a href>`/`<img src>` already carries in a plain React app, not something a toolcrib component does differently or is expected to guard for you.

---

## 4. Component Reference

Generated from `component-manifest.json` (`@manifestCategory`-grouped) — **Props** lists every prop name, not full types/defaults/descriptions; consult `component-manifest.json` or its per-category split under `ai-docs/manifest/` (see the callout above) for those. **Slots** are compound sub-components (`Card.Header`, etc.), `—` if none.

### Layout Primitives

Full prop detail: `ai-docs/manifest/layout-primitives.json`

| Component | Slots | Props | Description |
|:---|:---|:---|:---|
| `<AccessibleIcon>` | — | `label` | Adds a screen-reader-only accessible name to a decorative icon element |
| `<AspectRatio>` | — | `ratio` | Constrains content to a fixed width-to-height ratio |
| `<Block>` | — | `background`, `padding`, `paddingMode`, `radius`, `cornerRadiusMode`, `border`, `subtheme`, `appearance` | Themed, stylable container `<div>` with subtheme colouring — the one deliberate exception to "no style/className on toolcrib components", for ad-hoc layout needs nothing else covers |
| `<Content>` | `.Grow` | `gap`, `marginMode`, `squareCorners` | Fills its container and establishes a flex-column layout domain for its children |
| `<Grid>` | — | `columns`, `minColWidth`, `gap`, `marginMode`, `paddingMode` | CSS Grid responsive multi-column layout |
| `<HStack>` | — | `gap`, `align`, `justify`, `paddingMode`, `marginMode`, `cornerRadiusMode`, `wrap` | Horizontal flex row layout primitive |
| `<Separator>` | — | `orientation`, `decorative`, `overrides` | Themed visual divider between content sections |
| `<Toolbar>` | `.Left`, `.Center`, `.Right`, `.Button`, `.Separator` | `paddingMode`, `marginMode`, `cornerRadiusMode`, `orientation`, `overrides` | Horizontal action bar with left/center/right slot areas |
| `<UIGroup>` | — | `orientation`, `borderRadius` | Merges adjacent elements into a single visual compound control |
| `<VisuallyHidden>` | — | — | Hides content visually while keeping it announced to screen readers |
| `<VStack>` | — | `gap`, `align`, `justify`, `paddingMode`, `marginMode`, `cornerRadiusMode`, `wrap` | Vertical flex column layout primitive |

### Containers

Full prop detail: `ai-docs/manifest/containers.json`

| Component | Slots | Props | Description |
|:---|:---|:---|:---|
| `<AppShell>` | `.Header`, `.Main`, `.Sidebar` | `layout`, `overrides` | Full-viewport root layout frame with Header, Sidebar, and Main slots — the top-level wrapper for an entire app |
| `<Card>` | `.Header`, `.Content`, `.Footer`, `.Actions` | `layout`, `squareCorners`, `overrides` | Slot-based container with automatic layout domain corner squaring |
| `<CardSimple>` | — | `title`, `subtitle`, `footer`, `actions` | Token-saving shorthand for simple cards without slot composition |
| `<Collapsible>` | — | `id`, `trigger`, `defaultOpen`, `isOpen`, `onOpenChange`, `disabled`, `overrides` | Single expand/collapse content panel — see Accordion for a data-driven set of panels |
| `<DeferredContent>` | — | `estimatedHeight`, `onVisibilityChange` | Defers layout/paint of off-screen content via native content-visibility, for long lists/grids of many repeated items (e.g. many <Card>s, a long <Accordion>) — not for flex `1 1 0px` fill panels like Splitter.Panel/TabStrip.Panel, which are already always-visible and get no benefit from this |
| `<ScrollArea>` | — | `orientation`, `type`, `maxHeight`, `overrides` | Scrollable container with a themed, cross-browser custom scrollbar |
| `<Sidebar>` | — | `items`, `activeId`, `onItemClick`, `collapsed`, `defaultCollapsed`, `onCollapsedChange`, `overrides` | Vertical nav-item list built on Radix NavigationMenu, with a collapsed icon-only mode |
| `<Splitter>` | `.Panel` | `id`, `orientation`, `initialSplit`, `minSize` | Resizable two-panel layout with automatic corner-squaring domain |

### Overlays

Full prop detail: `ai-docs/manifest/overlays.json`

| Component | Slots | Props | Description |
|:---|:---|:---|:---|
| `<AlertDialog>` | `.Header`, `.Body`, `.Footer`, `.Actions`, `.Cancel`, `.Action` | `id`, `trigger`, `isOpen`, `onOpenChange`, `width`, `zIndex`, `ariaLabel`, `overrides` | Blocking confirmation dialog that cannot be light-dismissed — for destructive/irreversible actions |
| `<CommandPalette>` | — | `id`, `items`, `placeholder`, `emptyMessage`, `isOpen`, `onOpenChange`, `overrides` | Fuzzy-searchable command launcher opened via Cmd/Ctrl+K, hosted in a top-anchored Modal (VS Code-style quick-switcher placement) |
| `<ContextMenu>` | — | `id`, `items`, `overrides` | Right-click action menu, data-driven with separator support |
| `<Drawer>` | — | `id`, `trigger`, `position`, `isOpen`, `onOpenChange`, `title`, `width`, `zIndex` | Edge drawer overlay with backdrop blur and slide animation |
| `<DropdownMenu>` | — | `id`, `trigger`, `items`, `side`, `align`, `overrides` | Data-driven action menu with separator support |
| `<HoverCard>` | — | `id`, `content`, `side`, `align`, `openDelay`, `closeDelay`, `overrides` | Hover-triggered preview card for rich, interactive content |
| `<Modal>` | `.Header`, `.Body`, `.Footer`, `.Actions`, `.CloseButton` | `id`, `trigger`, `isOpen`, `onOpenChange`, `width`, `height`, `zIndex`, `ariaLabel`, `align`, `overrides` | Dialog overlay with focus trap, backdrop, and slot composition |
| `<Popup>` | — | `id`, `trigger`, `placement`, `isOpen`, `onOpenChange`, `zIndex`, `overrides` | Anchored popover with light dismiss and corner-squaring to trigger |
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
| `<DataTable>` | — | `id`, `data`, `columns`, `pagination`, `pageSize`, `pageSizeOptions`, `itemHeight`, `containerHeight`, `rowKey`, `rowSubtheme`, `onRowClick`, `sortKey`, `defaultSortKey`, `sortDirection`, `defaultSortDirection`, `onSortChange`, `page`, `defaultPage`, `onPageChange`, `selectable`, `selectedKeys`, `defaultSelectedKeys`, `onSelectionChange`, `renderBulkActions`, `overrides` | Virtualized, sortable, paginated data table with sticky headers |
| `<EmptyState>` | `.Icon`, `.Title`, `.Description`, `.Action` | — | Slot-based placeholder for an empty list/search/error state — same compositional pattern as `<Card>` |
| `<Filmstrip>` | — | `id`, `items`, `activeId`, `defaultActiveId`, `onChange`, `thumbnailSize`, `overrides` | Horizontally-scrollable thumbnail strip with an active-item indicator, reusing TabStrip's own overflow scroll detection |
| `<Gallery>` | — | `id`, `items`, `columns`, `onItemClick`, `overrides` | Thumbnail grid with lazy-rendered items, opening a fullscreen Viewer by default |
| `<Heatmap>` | — | `columns`, `rows`, `values`, `width`, `height`, `title`, `formatValue` | Row/column magnitude grid with a theme-tracking sequential ramp |
| `<LineChart>` | — | `categories`, `series`, `width`, `height`, `title`, `variant`, `legendPosition`, `overrides` | Multi-series line chart with a shared hover crosshair; `variant="area"` renders a stacked, filled area chart |
| `<PieChart>` | — | `data`, `width`, `height`, `innerRadius`, `title`, `legendPosition` | Part-to-whole pie or donut chart |
| `<Progress>` | — | `id`, `value`, `max`, `size`, `subtheme`, `overrides` | Determinate progress bar |
| `<ScaleLegend>` | — | `min`, `max`, `formatValue`, `width` | Gradient legend for a sequential (magnitude) color-encoded chart |
| `<Skeleton>` | — | `shape`, `width`, `height` | Shimmering loading placeholder in text/circle/rect shapes |
| `<Sparkline>` | — | `values`, `width`, `height`, `title` | Minimal inline trend line for a stat tile |
| `<Spinner>` | — | `size`, `subtheme` | Indeterminate circular loading indicator, same subtheme colouring as `<Progress>` |
| `<Stepper>` | — | `id`, `steps`, `activeIndex`, `defaultActiveIndex`, `onActiveIndexChange`, `overrides` | Linear step wizard built on the same Radix Tabs primitive as `<TabStrip>`, with per-step Form validation gating |
| `<TabStrip>` | `.Tab`, `.Panel` | `id`, `items`, `activeId`, `defaultActiveId`, `onChange`, `overrides` | Scrollable tab header with filmstrip overflow. Use TabStrip.Panel for content |
| `<Tree>` | — | `id`, `items`, `expandedIds`, `defaultExpandedIds`, `onExpandedChange`, `selectedId`, `defaultSelectedId`, `onSelectChange`, `overrides` | Data-driven tree view with expand/collapse, single selection, and full WAI-ARIA Treeview keyboard navigation |

### Form Controls

Full prop detail: `ai-docs/manifest/form-controls.json`

| Component | Slots | Props | Description |
|:---|:---|:---|:---|
| `<Button>` | — | `variant`, `size`, `paddingMode`, `cornerRadiusMode`, `leadingIcon`, `trailingIcon`, `icon`, `subtheme`, `squareCorners`, `overrides` | Styled button with five variants, three sizes, subtheme colouring, and icon slots |
| `<Calendar>` | — | `name`, `value`, `defaultValue`, `onChange`, `minValue`, `maxValue`, `isDisabled`, `locale`, `overrides`, `size` | Month grid for selecting a single date, built on React Aria Components |
| `<Combobox>` | — | `id`, `name`, `placeholder`, `ariaLabel`, `options`, `onSearch`, `searchDebounceMs`, `multiple`, `value`, `defaultValue`, `onChange`, `allowCustomValue`, `disabled`, `noResultsMessage`, `overrides`, `size` | Filterable text input with a listbox, supporting client-side or async search and single/multi selection, bound to Form context |
| `<DatePicker>` | — | `name`, `label`, `value`, `defaultValue`, `onChange`, `minValue`, `maxValue`, `isDisabled`, `locale`, `overrides`, `size` | Date field + calendar popover, hosted in `<Popup>` (not React Aria's own popover), built on React Aria Components |
| `<FileUpload>` | — | `name`, `accept`, `multiple`, `maxSizeBytes`, `maxFiles`, `disabled`, `onUpload`, `onFilesChange`, `overrides`, `size` | Drag-and-drop file picker with per-file progress and image thumbnails, bound to Form context |
| `<Form>` | — | `schema`, `initialValues`, `onSubmit`, `id` | Zod 4 schema-driven form. Controls bind via context — no register() or onChange boilerplate |
| `<Label>` | — | `overrides` | Accessible label for a form control, associated via htmlFor or by wrapping it |
| `<Listbox>` | — | `id`, `options`, `activeIndex`, `selectedValues`, `onSelect`, `loading`, `loadingMessage`, `emptyMessage`, `multiSelectable`, `itemPadding`, `size` | Keyboard-navigable, controlled option list with no matching Radix primitive to build on — extracted from Combobox's own hand-built listbox, now usable standalone |
| `<Pagination>` | — | `id`, `totalItems`, `pageSize`, `page`, `defaultPage`, `onPageChange`, `size` | Page-number navigation control with Prev/Next, built on `<Button>` and shared page-index math with `<DataTable>` |
| `<RadioGroup>` | `.Option` | `name`, `value`, `defaultValue`, `onChange`, `options`, `direction`, `disabled`, `overrides`, `size` | Single-select radio control bound to Form context, data-driven or compositional |
| `<Rating>` | — | `name`, `value`, `defaultValue`, `onChange`, `max`, `icon`, `readOnly`, `overrides` | Star rating control built on Radix RadioGroup, or a read-only fractional-fill display |
| `<Select>` | — | `id`, `name`, `placeholder`, `options`, `value`, `defaultValue`, `onChange`, `disabled`, `overrides`, `size` | Dropdown select control bound to Form context, built on Radix Select |
| `<Slider>` | — | `id`, `name`, `value`, `defaultValue`, `min`, `max`, `step`, `onChange`, `disabled`, `commitOnRelease`, `ariaLabel`, `overrides` | Range input control built on Radix Slider |
| `<ThemeEditor>` | — | `themeManagement`, `themeManagementSlot` | Real-time HSV theme editor content — no overlay chrome of its own;
host it inside a `<Drawer>` (or `<Modal>`/`<Popup>`) of your choosing. |
| `<TimeField>` | — | `name`, `label`, `value`, `defaultValue`, `onChange`, `granularity`, `hourCycle`, `isDisabled`, `locale`, `size` | Segmented time input (hour/minute/second, individually keyboard-editable) built on React Aria Components |
| `<Toggle>` | — | `name`, `pressed`, `defaultPressed`, `onPressedChange`, `disabled`, `overrides`, `size` | Two-state pressed/unpressed button, standalone (see ToggleGroup for a connected set) |
| `<ToggleGroup>` | — | `name`, `type`, `value`, `defaultValue`, `onChange`, `options`, `disabled`, `overrides`, `size` | Connected button set for single or multiple selection, data-driven |

`<Modal ariaLabel>` and `<Drawer title>` are **not** the same kind of prop: `Modal.ariaLabel` is a screen-reader-only string (`Modal.Header`'s visible text is decorative and not otherwise wired to the dialog's accessible name), while `Drawer.title` is a visible `ReactNode` rendered in the drawer header. Don't assume one works like the other.

### Toast Subsystem

Requires `<ToastProvider>` + `<ToastContainer>` at the root (see §1).

```tsx
// Simple: one-liner
aiBus.showToast('Saved successfully', 'success');

// Advanced: with actions, sticky, custom anchor
const { addToast } = useToast();
addToast({
  type: 'error',
  message: 'Connection lost',
  sticky: true,
  actions: [{ label: 'Retry', onClick: reconnect }],
  anchor: 'bottom-center',
});
```

### Theme Editor

```tsx
<ThemeEditor trigger={<Button variant="ghost" icon="🎨">Theme</Button>} />
```

---

## 5. `layout="auto"` — Fill & Corner-Squaring

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

## 6. Z-Index Scale

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

## 7. CSS Variable Theme System (HSV-Derived)

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

## 8. Theme Slices

The theme system is extensible via **slices**. Each slice provides:
- A state interface
- CSS variable generation from that state
- An optional editor control for the Theme Editor

Built-in slices: `padding`, `margin`, `radius`, `shadow`, `table`, `animation`, `tab`, `drawer`, `accordion`, `card`, `tooltip`, `button`, `input`, `togglecontrol`, `select`, `radiogroup`, `slider`, `modal`, `alertdialog`, `popup`, `toast`, `dropdownmenu`, `contextmenu`, `progress`, `separator`, `avatar`, `toggle`, `collapsible`, `uigroup`, `toolbar`, `appshell`, `typography`, `tree`, `rating`, `sidebar`, `stepper`, `datepicker`, `breadcrumb`, `carousel`, `combobox`, `commandpalette`, `fileUpload`, `gallery`, `hoverCard`, `label`, `scrollArea`, `viewer`, `chart`, `livingColor`.

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

## 9. Per-Instance Overrides & Style Domains

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

If neither `overrides` nor a style domain covers what you need on a specific component, that's a real, intentional boundary on that component — the toolkit trades some flexibility for keeping most visual decisions theme-driven and AI-legible. A plain `<div>` (or any other raw HTML element) is always a fine way past that boundary — `style`/`className` never stopped working on your own markup, toolcrib components just don't expose them on their own props. `<Block>` (§2, principle 7) is there for when a themed `<div>` is specifically what you want: it accepts real `style`/`className` the same as any raw element, but its own `background`/`padding`/`radius`/`border` default to the same theme CSS variables every other component resolves through, so reaching for it doesn't mean falling back to un-themed raw styling.

---

## 10. Event Bus — Complete Payload Reference

Most events are fire-and-forget: a subscriber only sees them from the moment it calls `useAIEvent`/`aiBus.on` onward. A few events (currently `tab:changed`) are **sticky** — the bus remembers the last payload per discriminator (its `id` field) and replays it immediately to a new subscriber, so a late-mounting listener still learns the current state instead of only future changes. This matters for components with no shared DOM ancestor or mount-order guarantee, like `<TabStrip>` and `<TabStrip.Panel>`.

Rendered in [TOON](https://github.com/toon-format/spec) form (`[count]{keys}:` header, one indented row per entry) — more token-compact than a Markdown table for a strongly-typed AI reader, and generated directly from `eventBus.channels` in `component-manifest.json` so it can't drift from it:

```
[68]{name,payload}:
  "theme:changed","{ parameters: ThemeParameters; palette: GeneratedPalette; cssVariables: Record<string, string>; }"
  "element:resized","{ id?: string; target: HTMLElement; width: number; height: number; contentHeight: number }"
  "element:intersected","{ id?: string; target: HTMLElement; isIntersecting: boolean; ratio: number }"
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
  "toast:shown","{ id: string; type: SubthemeName; message: string; priority?: 'low' | 'medium' | 'high' | 'urgent' }"
  "toast:added","{ id: string; type: SubthemeName; message: string; priority?: 'low' | 'medium' | 'high' | 'urgent' }"
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
  "toggle:changed","{ name?: string; pressed: boolean }"
  "rating:changed","{ name?: string; value: number }"
  "datepicker:changed","{ name?: string; value: string | null }"
  "calendar:changed","{ name?: string; value: string | null }"
  "timefield:changed","{ name?: string; value: string | null }"
  "togglegroup:changed","{ name?: string; value: string | string[] }"
  "progress:changed","{ id?: string; value: number; max: number }"
  "carousel:changed","{ id?: string; activeIndex: number; previousIndex?: number }"
  "tab:changed","{ id?: string; activeId: string; previousId?: string }"
  "filmstrip:changed","{ id?: string; activeId: string; previousId?: string }"
  "viewer:item_changed","{ id?: string; activeIndex: number }"
  "viewer:shown","{ id?: string }"
  "viewer:hidden","{ id?: string }"
  "stepper:changed","{ id?: string; activeIndex: number; previousIndex?: number }"
  "datatable:sorted","{ id?: string; key: string | null; direction: 'asc' | 'desc' }"
  "datatable:paginated","{ id?: string; page: number; pageSize: number }"
  "datatable:selection_changed","{ id?: string; selectedKeys: string[] }"
  "pagination:changed","{ id?: string; page: number; pageSize: number }"
  "datatable:row_clicked","{ id?: string; index: number }"
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

