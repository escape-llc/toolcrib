# Toolcrib — Core Reference & System Prompt

`toolcrib` is a React component library designed specifically for AI code generation ("vibe coding"). It provides structural UI components, slot-based composition without prop-drilling, a strongly-typed Event Bus, a Zod 4 form validation engine, and an HSV-based CSS variable theme system.

**Always include this file's content in your system instructions** (Cursor `.cursorrules`, `AGENTS.md`, `CLAUDE.md`, Custom GPTs) when working in a project that uses `toolcrib`. In addition to this file, also include exactly one of:
- **`NEW_APP.md`** — starting a project from scratch with `toolcrib` as the UI layer from day one.
- **`REFACTOR_APP.md`** — introducing `toolcrib` into a codebase that already has UI, styling, and state management.

> **Two documents, two different jobs — load both.** This file is the source of truth for **rules, conventions, and behavior**: what's forbidden, why, and how the pieces fit together. **`component-manifest.json`** is the source of truth for **exact, enumerable data**: every component's full prop list with types/defaults/required flags, the complete `--ai-*` CSS variable list, the full event-channel/payload table, and the z-index scale. It's generated directly from source (`scripts/generate-manifest.js`) and kept in sync by a CI check — so it cannot go stale the way hand-maintained prose can. Where this file gives you a short pointer instead of a full table, that's intentional: **consult the manifest, don't guess or recall from memory.**

> **Reading strategy for the Component Reference (§4) and the manifest.** §4's table already gives you every component's name, slots, and prop *names* — enough to pick the right component and call it correctly by convention. Read `component-manifest.json` (or its per-category split, next) only when §4 doesn't tell you enough: exact prop types, `@default` values, `required` flags, or slot-prop shapes. When you do, prefer the split file under `ai-docs/manifest/<category-slug>.json` for the category you're working in (e.g. `ai-docs/manifest/data-display.json` for `<DataTable>`) — same content as that category in `component-manifest.json`, a fraction of the size. `component-manifest.json` itself remains the single source of truth for the non-component-specific data (`themeSystem`, `zIndexScale`, `eventBus`) and for anything spanning more than one category at once. Worked examples for mechanisms with no prior in ordinary React/Radix training data — `overrides`+`StyleDomain` composition, the event bus's sticky-replay semantics, the z-index scale — live under `ai-docs/examples/`; read the relevant one before touching one of those mechanisms for the first time in a session.

> **Import path.** After `toolcrib init` / `toolcrib apply`, the toolkit is vendored into `./toolcrib/` and wired to the `#toolcrib` subpath import via your `package.json`'s `"imports"` field — never `from 'toolcrib'` or a relative path. This is the one specifier that works identically from any file in your project, regardless of location or bundler:
> ```tsx
> import { Card, aiBus } from '#toolcrib';
> ```

> **All units are `rem`** (derived from `--ai-master-font-size` in `px`). Never hardcode `px` values.

---

## 1. Root Setup

Three providers must wrap your app root exactly once — components will throw ("must be used within a ...Provider") or silently no-op without them:

```tsx
import { ThemeProvider, ToastProvider, ToastContainer } from '#toolcrib';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ThemeProvider>
    <ToastProvider>
      <App />
      {/* ToastContainer renders the actual toast stack. Omitting it is a
          common silent failure: aiBus.showToast() / addToast() still update
          state and emit bus events, but nothing appears on screen. */}
      <ToastContainer />
    </ToastProvider>
  </ThemeProvider>
);
```

`ThemeProvider` injects the HSV-derived CSS variables at `:root` on mount — nothing themed will render correctly without it. `ToastProvider` + `ToastContainer` are independent of `ThemeProvider` but must both be present together (the provider holds state; the container renders it).

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
7. **NO `style`/`className` on Toolcrib Components.** No component in this toolkit accepts either prop — this is enforced by the type system, not just convention. Use `overrides` for per-instance theme control (§9) instead of ad hoc inline styles. `style`/`className` still work normally on your own plain HTML elements (`<div>`, `<span>`, ...) — the restriction is specifically the toolkit's own component API surface.

---

## 3. ⛔ Anti-Patterns — DO NOT Generate These

| ❌ Don't | ✅ Do Instead |
|:---|:---|
| Manually manage overlay open/close with `useState` | Let `<Modal>`, `<Drawer>`, `<Popup>` manage state internally, or use `aiBus.openModal(id)` |
| Hardcode `z-index` values | Use the `Z_INDEX` scale: `import { Z_INDEX } from '#toolcrib'` |
| Use `px` units for spacing, borders, radii | Use `rem` values. Only `--ai-master-font-size` is in `px` |
| Hardcode colour values (hex, rgb) | Use CSS variables: `var(--ai-color-primary)`, `var(--ai-subtheme-error)` |
| Prop-drill callbacks through component trees | Use `aiBus.emit()` / `useAIEvent()` for cross-tree communication |
| Write `register()` or `onChange` boilerplate for form fields | Nest `<Input>`, `<Select>`, etc. inside `<FormField name="...">` — binding is automatic |
| Create custom popup/modal/drawer components | Use the toolkit's `<Popup>`, `<Modal>`, `<Drawer>` — they handle anchoring, focus traps, backdrop, and light dismiss |
| Use `position: fixed` with manual z-index | Use the overlay components — they portal correctly and use the Z_INDEX scale |
| Pass `style={{...}}` or `className="..."` to a toolcrib component | Use that component's `overrides` prop (§9) if it has theme-controlled axes; if what you need genuinely isn't one of them, wrap the component in your own plain `<div>` instead |
| Fake per-row emphasis in `<DataTable>` via `column.render` (styling each cell individually to approximate a highlighted row) | Use `<DataTable rowSubtheme={(record) => ...}>` — classifies a row into `'error'` / `'success'` / `'warning'` / `'info'` and tints the actual row background/border, not a per-cell approximation |

---

## 4. Component Reference

Generated from `component-manifest.json` (`@manifestCategory`-grouped) — **Props** lists every prop name, not full types/defaults/descriptions; consult `component-manifest.json` or its per-category split under `ai-docs/manifest/` (see the callout above) for those. **Slots** are compound sub-components (`Card.Header`, etc.), `—` if none.

### Layout Primitives

Full prop detail: `ai-docs/manifest/layout-primitives.json`

| Component | Slots | Props | Description |
|:---|:---|:---|:---|
| `<AccessibleIcon>` | — | `label` | Adds a screen-reader-only accessible name to a decorative icon element |
| `<AspectRatio>` | — | `ratio` | Constrains content to a fixed width-to-height ratio |
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
| `<AppShell>` | `.Header`, `.Main` | `overrides` | Full-viewport root layout frame with Header and Main slots — the top-level wrapper for an entire app |
| `<Card>` | `.Header`, `.Content`, `.Footer`, `.Actions` | `layout`, `squareCorners`, `overrides` | Slot-based container with automatic layout domain corner squaring |
| `<CardSimple>` | — | `title`, `subtitle`, `footer`, `actions` | Token-saving shorthand for simple cards without slot composition |
| `<Collapsible>` | — | `id`, `trigger`, `defaultOpen`, `isOpen`, `onOpenChange`, `disabled`, `overrides` | Single expand/collapse content panel — see Accordion for a data-driven set of panels |
| `<DeferredContent>` | — | `estimatedHeight`, `onVisibilityChange` | Defers layout/paint of off-screen content via native content-visibility, for long lists/grids of many repeated items (e.g. many <Card>s, a long <Accordion>) — not for flex `1 1 0px` fill panels like Splitter.Panel/TabStrip.Panel, which are already always-visible and get no benefit from this |
| `<ScrollArea>` | — | `orientation`, `type`, `maxHeight`, `overrides` | Scrollable container with a themed, cross-browser custom scrollbar |
| `<Splitter>` | `.Panel` | `id`, `orientation`, `initialSplit`, `minSize` | Resizable two-panel layout with automatic corner-squaring domain |

### Overlays

Full prop detail: `ai-docs/manifest/overlays.json`

| Component | Slots | Props | Description |
|:---|:---|:---|:---|
| `<AlertDialog>` | `.Header`, `.Body`, `.Footer`, `.Actions`, `.Cancel`, `.Action` | `id`, `trigger`, `isOpen`, `onOpenChange`, `width`, `zIndex`, `ariaLabel`, `overrides` | Blocking confirmation dialog that cannot be light-dismissed — for destructive/irreversible actions |
| `<ContextMenu>` | — | `id`, `items`, `overrides` | Right-click action menu, data-driven with separator support |
| `<Drawer>` | — | `id`, `trigger`, `position`, `isOpen`, `onOpenChange`, `title`, `width`, `zIndex` | Edge drawer overlay with backdrop blur and slide animation |
| `<DropdownMenu>` | — | `id`, `trigger`, `items`, `side`, `align`, `overrides` | Data-driven action menu with separator support |
| `<HoverCard>` | — | `id`, `content`, `side`, `align`, `openDelay`, `closeDelay`, `overrides` | Hover-triggered preview card for rich, interactive content |
| `<Modal>` | `.Header`, `.Body`, `.Footer`, `.Actions`, `.CloseButton` | `id`, `trigger`, `isOpen`, `onOpenChange`, `width`, `zIndex`, `ariaLabel`, `overrides` | Dialog overlay with focus trap, backdrop, and slot composition |
| `<Popup>` | — | `id`, `trigger`, `placement`, `isOpen`, `onOpenChange`, `zIndex`, `overrides` | Anchored popover with light dismiss and corner-squaring to trigger |
| `<Tooltip>` | — | `id`, `content`, `side`, `align`, `delayDuration`, `overrides` | Hover/focus tooltip wrapping a child trigger element |

### Data Display

Full prop detail: `ai-docs/manifest/data-display.json`

| Component | Slots | Props | Description |
|:---|:---|:---|:---|
| `<Accordion>` | — | `id`, `items`, `type`, `defaultValue`, `overrides` | Data-driven collapsible panel group with animations |
| `<Avatar>` | — | `src`, `alt`, `fallback`, `size`, `fallbackDelayMs`, `overrides` | User/entity avatar image with automatic initials fallback |
| `<DataTable>` | — | `id`, `data`, `columns`, `pagination`, `pageSize`, `pageSizeOptions`, `itemHeight`, `containerHeight`, `rowKey`, `rowSubtheme`, `onRowClick`, `sortKey`, `defaultSortKey`, `sortDirection`, `defaultSortDirection`, `onSortChange`, `page`, `defaultPage`, `onPageChange`, `overrides` | Virtualized, sortable, paginated data table with sticky headers |
| `<Progress>` | — | `id`, `value`, `max`, `size`, `subtheme`, `overrides` | Determinate progress bar |
| `<TabStrip>` | `.Tab`, `.Panel` | `id`, `items`, `activeId`, `defaultActiveId`, `onChange`, `overrides` | Scrollable tab header with filmstrip overflow. Use TabStrip.Panel for content |

### Form Controls

Full prop detail: `ai-docs/manifest/form-controls.json`

| Component | Slots | Props | Description |
|:---|:---|:---|:---|
| `<Button>` | — | — | Styled button with five variants, three sizes, subtheme colouring, and icon slots |
| `<Combobox>` | — | `name`, `placeholder`, `options`, `onSearch`, `searchDebounceMs`, `multiple`, `value`, `defaultValue`, `onChange`, `allowCustomValue`, `disabled`, `noResultsMessage`, `overrides` | Filterable text input with a listbox, supporting client-side or async search and single/multi selection, bound to Form context |
| `<FileUpload>` | — | `name`, `accept`, `multiple`, `maxSizeBytes`, `maxFiles`, `disabled`, `onUpload`, `onFilesChange`, `overrides` | Drag-and-drop file picker with per-file progress and image thumbnails, bound to Form context |
| `<Form>` | — | `schema`, `initialValues`, `onSubmit`, `id` | Zod 4 schema-driven form. Controls bind via context — no register() or onChange boilerplate |
| `<Label>` | — | `overrides` | Accessible label for a form control, associated via htmlFor or by wrapping it |
| `<RadioGroup>` | `.Option` | `name`, `value`, `defaultValue`, `onChange`, `options`, `direction`, `disabled`, `overrides` | Single-select radio control bound to Form context, data-driven or compositional |
| `<Select>` | — | `name`, `placeholder`, `options`, `value`, `defaultValue`, `onChange`, `disabled`, `overrides` | Dropdown select control bound to Form context, built on Radix Select |
| `<Slider>` | — | `name`, `value`, `defaultValue`, `min`, `max`, `step`, `onChange`, `disabled`, `commitOnRelease`, `overrides` | Range input control built on Radix Slider |
| `<ThemeEditor>` | — | `themeManagement`, `themeManagementSlot` | Real-time HSV theme editor content — no overlay chrome of its own;
host it inside a `<Drawer>` (or `<Modal>`/`<Popup>`) of your choosing. |
| `<Toggle>` | — | `name`, `pressed`, `defaultPressed`, `onPressedChange`, `disabled`, `overrides` | Two-state pressed/unpressed button, standalone (see ToggleGroup for a connected set) |
| `<ToggleGroup>` | — | `name`, `type`, `value`, `defaultValue`, `onChange`, `options`, `disabled`, `overrides` | Connected button set for single or multiple selection, data-driven |

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

Built-in slices: `padding`, `margin`, `radius`, `shadow`, `table`, `animation`, `tab`, `drawer`, `accordion`, `card`, `tooltip`, `button`, `input`, `togglecontrol`, `select`, `radiogroup`, `slider`, `modal`, `alertdialog`, `popup`, `toast`, `dropdownmenu`, `contextmenu`, `progress`, `separator`, `avatar`, `toggle`, `collapsible`, `uigroup`, `toolbar`, `appshell`, `typography`.

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

If neither `overrides` nor a style domain covers what you need, that's a real, intentional boundary — the toolkit trades some flexibility for keeping every visual decision theme-driven and AI-legible. There is no raw-style escape hatch on toolcrib components themselves.

---

## 10. Event Bus — Complete Payload Reference

Most events are fire-and-forget: a subscriber only sees them from the moment it calls `useAIEvent`/`aiBus.on` onward. A few events (currently `tab:changed`) are **sticky** — the bus remembers the last payload per discriminator (its `id` field) and replays it immediately to a new subscriber, so a late-mounting listener still learns the current state instead of only future changes. This matters for components with no shared DOM ancestor or mount-order guarantee, like `<TabStrip>` and `<TabStrip.Panel>`.

Rendered in [TOON](https://github.com/toon-format/spec) form (`[count]{keys}:` header, one indented row per entry) — more token-compact than a Markdown table for a strongly-typed AI reader, and generated directly from `eventBus.channels` in `component-manifest.json` so it can't drift from it:

```
[46]{name,payload}:
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
  "menu:opened","{ id?: string }"
  "menu:closed","{ id?: string }"
  "menu:item_selected","{ id?: string; itemValue: string }"
  "select:changed","{ name?: string; value: string }"
  "combobox:changed","{ name?: string; value: string | string[] }"
  "fileupload:changed","{ name?: string; fileCount: number }"
  "slider:changed","{ name?: string; value: number }"
  "toggle:changed","{ name?: string; pressed: boolean }"
  "togglegroup:changed","{ name?: string; value: string | string[] }"
  "progress:changed","{ id?: string; value: number; max: number }"
  "tab:changed","{ id?: string; activeId: string; previousId?: string }"
  "datatable:sorted","{ id?: string; key: string | null; direction: 'asc' | 'desc' }"
  "datatable:paginated","{ id?: string; page: number; pageSize: number }"
  "datatable:row_clicked","{ id?: string; index: number }"
  "log:cleared","{ timestamp: string }"
  "layout:domain:created","{ domainId: string; parentId: string; orientation: 'horizontal' | 'vertical' }"
  "layout:corners:squared","{ domainId: string; slot: 'first' | 'second'; orientation: 'horizontal' | 'vertical'; squaredCorners: { topLeft?: boolean; topRight?: boolean; bottomLeft?: boolean; bottomRight?: boolean; }; }"
```

Notable payloads:
- `error:boundary` — emitted by `<AIErrorBoundary>` (used internally by `<Modal>`/`<Drawer>`) whenever a child throws during render
- `tab:changed` — `id` is the `<TabStrip id>` group identifier; sticky (see above), so a `<TabStrip.Panel>` mounted after this fires still gets the current value replayed to it

