# Toolcrib — Core Reference & System Prompt

`toolcrib` is a React component library designed specifically for AI code generation ("vibe coding"). It provides structural UI components, slot-based composition without prop-drilling, a strongly-typed Event Bus, a Zod 4 form validation engine, and an HSV-based CSS variable theme system.

**Always include this file's content in your system instructions** (Cursor `.cursorrules`, `AGENTS.md`, Claude System Prompt, Custom GPTs) when working in a project that uses `toolcrib`. It is the single source of truth for the toolkit's rules — component reference, event bus, and theme system. In addition to this file, also include exactly one of:
- **`NEW_APP.md`** — starting a project from scratch with `toolcrib` as the UI layer from day one.
- **`REFACTOR_APP.md`** — introducing `toolcrib` into a codebase that already has UI, styling, and state management.

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
2. **NO Manual `useState` for Overlays.** `<Popup>`, `<SlideOut>`, and `<Modal>` manage open/close state internally or via `aiBus`.
3. **Cross-Tree Actions via Event Bus.** Trigger overlays, toasts, and form actions from anywhere:
   ```tsx
   import { aiBus, useAIEvent } from '#toolcrib';
   aiBus.openModal('delete-confirm', { itemId: row.id });
   aiBus.showToast('Item deleted', 'success');
   useAIEvent('modal:shown', (e) => { /* auto-cleanup */ });
   ```
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
| Manually manage overlay open/close with `useState` | Let `<Modal>`, `<SlideOut>`, `<Popup>` manage state internally, or use `aiBus.openModal(id)` |
| Hardcode `z-index` values | Use the `Z_INDEX` scale: `import { Z_INDEX } from '#toolcrib'` |
| Use `px` units for spacing, borders, radii | Use `rem` values. Only `--ai-master-font-size` is in `px` |
| Hardcode colour values (hex, rgb) | Use CSS variables: `var(--ai-color-primary)`, `var(--ai-subtheme-error)` |
| Prop-drill callbacks through component trees | Use `aiBus.emit()` / `useAIEvent()` for cross-tree communication |
| Write `register()` or `onChange` boilerplate for form fields | Nest `<Input>`, `<Select>`, etc. inside `<FormField name="...">` — binding is automatic |
| Create custom popup/modal/drawer components | Use the toolkit's `<Popup>`, `<Modal>`, `<SlideOut>` — they handle anchoring, focus traps, backdrop, and light dismiss |
| Use `position: fixed` with manual z-index | Use the overlay components — they portal correctly and use the Z_INDEX scale |
| Pass `style={{...}}` or `className="..."` to a toolcrib component | Use that component's `overrides` prop (§9) if it has theme-controlled axes; if what you need genuinely isn't one of them, wrap the component in your own plain `<div>` instead |

---

## 4. Component Reference

### Layout Primitives

| Component | Key Props | Description |
|:---|:---|:---|
| `<VStack>` | `gap`, `align`, `justify` | Vertical flex column. `gap` defaults to theme `'gap'` token |
| `<HStack>` | `gap`, `align`, `justify` | Horizontal flex row. `align` defaults to `'center'` |
| `<Grid>` | `columns`, `minColWidth`, `gap` | CSS Grid. `columns` can be number, `'auto-fit'`, or `'auto-fill'` |
| `<Toolbar>` | `paddingMode`, `cornerRadiusMode` | Horizontal bar with `Toolbar.Left`, `Toolbar.Center`, `Toolbar.Right` slots |
| `<UIGroup>` | `orientation` | Merges adjacent elements (e.g. buttons) into a single visual control |

### Containers

| Component | Slots | Key Props | Description |
|:---|:---|:---|:---|
| `<Card>` | `.Header`, `.Content`, `.Footer`, `.Actions` | `layout`, `squareCorners` | Slot-based panel. **`layout="auto"`** enables flex-fill + corner-squaring |
| `<Splitter>` | `<Splitter.Panel>` (exactly 2) | `orientation`, `initialSplit`, `minSize` | Resizable two-panel layout with automatic corner-squaring domain |

### Overlays

| Component | Slots | Key Props | Bus Events |
|:---|:---|:---|:---|
| `<Modal>` | `.Header`, `.Body`, `.Footer`, `.Actions`, `.CloseButton` | `id`, `trigger`, `width`, `ariaLabel` | `modal:shown`, `modal:hidden` |
| `<SlideOut>` | children (body content) | `id`, `trigger`, `position`, `title`, `width` | `slideout:shown`, `slideout:hidden` |
| `<Popup>` | children (popover content) | `id`, `trigger`, `placement` | `popup:shown`, `popup:hidden` |
| `<Tooltip>` | children (trigger element) | `content`, `side`, `align`, `delayDuration` | `tooltip:shown`, `tooltip:hidden` |
| `<DropdownMenu>` | data-driven via `items` | `trigger`, `items`, `side`, `align` | `menu:opened`, `menu:closed`, `menu:item_selected` |

`<Modal ariaLabel>` and `<SlideOut title>` are **not** the same kind of prop: `Modal.ariaLabel` is a screen-reader-only string (`Modal.Header`'s visible text is decorative and not otherwise wired to the dialog's accessible name), while `SlideOut.title` is a visible `ReactNode` rendered in the drawer header. Don't assume one works like the other.

### Data Display

| Component | Key Props | Description |
|:---|:---|:---|
| `<DataTable>` | `data`, `columns`, `pageSize`, `itemHeight` | Virtualized, sortable, paginated table |
| `<Accordion>` | `items`, `type`, `defaultValue` | Collapsible panel group. `type='single'` or `'multiple'` |
| `<TabStrip>` + `<TabStrip.Panel>` | `items`, `activeId`, `onChange` | Scrollable tab header + conditional content panels |

### Form Controls

| Component | Key Props | Notes |
|:---|:---|:---|
| `<Form>` | `schema`, `initialValues`, `onSubmit` | Zod 4 validation engine. Wraps `<form>` with context |
| `<FormField>` | `name`, `label`, `helperText` | Wraps a control with label + error display. Auto-passes `name` to children |
| `<FormError>` | `name` | Field-level error or summary banner |
| `<Input>` | `name`, `type`, `cornerRadiusMode` | Auto-binds to form context. Name inherited from `<FormField>` |
| `<Textarea>` | `name`, `rows` | Multi-line text input |
| `<Select>` | `name`, `options`, `placeholder` | Radix UI dropdown select |
| `<Checkbox>` | `name`, `label`, `checked` | Boolean toggle with label |
| `<Switch>` | `name`, `label`, `checked` | Sliding track toggle |
| `<RadioGroup>` | `name`, `options`, `direction` | Single-select option group |
| `<Slider>` | `name`, `min`, `max`, `step` | Range slider input |
| `<Button>` | `variant`, `size`, `subtheme`, `icon` | Five variants: `primary`, `secondary`, `outline`, `danger`, `ghost` |
| `<SubmitButton>` | same as Button | Auto-disables during form submission |

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
|:---|:---:|:---|
| `BASE` | 0 | Cards, Grids, Stacks, Accordion |
| `STICKY` | 10 | DataTable headers, sticky Toolbars |
| `SPLITTER` | 20 | Splitter resize handles |
| `DRAWER` | 100 | SlideOut drawers, Theme Editor |
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

---

## 8. Theme Slices

The theme system is extensible via **slices**. Each slice provides:
- A state interface
- CSS variable generation from that state
- An optional editor control for the Theme Editor

Built-in slices: `padding`, `margin`, `radius`, `shadow`, `animation`, `dataTable`, `tab`, `slideOut`, `accordion`, `card`, `tooltip`.

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

This is Context-based on purpose, not CSS-variable inheritance — `<Modal>`, `<Popup>`, and `<SlideOut>` all render their content through a portal elsewhere in the DOM, and `<StyleDomainProvider>` still reaches them correctly because it follows the component tree, not DOM position.

If neither `overrides` nor a style domain covers what you need, that's a real, intentional boundary — the toolkit trades some flexibility for keeping every visual decision theme-driven and AI-legible. There is no raw-style escape hatch on toolcrib components themselves.

---

## 10. Event Bus — Complete Payload Reference

Most events are fire-and-forget: a subscriber only sees them from the moment it calls `useAIEvent`/`aiBus.on` onward. A few events (currently `tab:changed`) are **sticky** — the bus remembers the last payload per discriminator (its `id` field) and replays it immediately to a new subscriber, so a late-mounting listener still learns the current state instead of only future changes. This matters for components with no shared DOM ancestor or mount-order guarantee, like `<TabStrip>` and `<TabStrip.Panel>`.

| Event | Payload Type |
|:---|:---|
| `theme:changed` | `{ parameters: ThemeParameters; palette: GeneratedPalette; cssVariables: Record<string, string> }` |
| `popup:shown` | `{ id: string; targetId?: string; data?: any }` |
| `popup:hidden` | `{ id: string }` |
| `slideout:shown` | `{ id: string; position?: 'top'\|'right'\|'bottom'\|'left'; data?: any }` |
| `slideout:hidden` | `{ id: string }` |
| `modal:shown` | `{ id: string; data?: any }` |
| `modal:hidden` | `{ id: string }` |
| `toast:shown` | `{ id: string; type: ToastType; message: string; priority?: ToastPriority }` |
| `toast:dismissed` | `{ id: string; reason?: 'user'\|'expired'\|'action' }` |
| `form:submitted` | `{ formId?: string; values: Record<string, any> }` |
| `form:validated` | `{ formId?: string; isValid: boolean }` |
| `form:errored` | `{ formId?: string; errors: Record<string, string> }` |
| `tab:changed` | `{ id?: string; activeId: string; previousId?: string }` — `id` is the `<TabStrip id>` group identifier; sticky (see below), so a `<TabStrip.Panel>` mounted after this fires still gets the current value replayed to it |
| `accordion:opened` | `{ id?: string; itemValue: string }` |
| `accordion:closed` | `{ id?: string; itemValue: string }` |
| `select:changed` | `{ name?: string; value: string }` |
| `slider:changed` | `{ name?: string; value: number }` |
| `menu:opened` | `{ id?: string }` |
| `menu:closed` | `{ id?: string }` |
| `menu:item_selected` | `{ id?: string; itemValue: string }` |
| `tooltip:shown` | `{ id?: string; content: string }` |
| `tooltip:hidden` | `{ id?: string }` |
| `error:boundary` | `{ componentName: string; error: string; stack?: string }` — emitted by `<AIErrorBoundary>` (used internally by `<Modal>`/`<SlideOut>`) whenever a child throws during render |
