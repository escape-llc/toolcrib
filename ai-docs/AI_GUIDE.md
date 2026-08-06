# AI-UI Toolkit — System Prompt & Developer Guide

`ai-ui` is a React component library designed specifically for AI code generation ("vibe coding"). It provides structural UI components, slot-based composition without prop-drilling, a strongly-typed Event Bus, a Zod 4 form validation engine, and an HSV-based CSS variable theme system.

> **All units are `rem`** (derived from `--ai-master-font-size` in `px`). Never hardcode `px` values.

---

## 1. Core Principles

1. **NO Prop-Drilling.** Use slot subcomponents (e.g. `<Card.Header>`, `<Modal.Actions>`) and React contexts.
2. **NO Manual `useState` for Overlays.** `<Popup>`, `<SlideOut>`, and `<Modal>` manage open/close state internally or via `aiBus`.
3. **Cross-Tree Actions via Event Bus.** Trigger overlays, toasts, and form actions from anywhere:
   ```tsx
   import { aiBus, useAIEvent } from 'ai-ui';
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

---

## 2. ⛔ Anti-Patterns — DO NOT Generate These

| ❌ Don't | ✅ Do Instead |
|:---|:---|
| Manually manage overlay open/close with `useState` | Let `<Modal>`, `<SlideOut>`, `<Popup>` manage state internally, or use `aiBus.openModal(id)` |
| Hardcode `z-index` values | Use the `Z_INDEX` scale: `import { Z_INDEX } from 'ai-ui'` |
| Use `px` units for spacing, borders, radii | Use `rem` values. Only `--ai-master-font-size` is in `px` |
| Hardcode colour values (hex, rgb) | Use CSS variables: `var(--ai-color-primary)`, `var(--ai-subtheme-error)` |
| Prop-drill callbacks through component trees | Use `aiBus.emit()` / `useAIEvent()` for cross-tree communication |
| Write `register()` or `onChange` boilerplate for form fields | Nest `<Input>`, `<Select>`, etc. inside `<FormField name="...">` — binding is automatic |
| Create custom popup/modal/drawer components | Use the toolkit's `<Popup>`, `<Modal>`, `<SlideOut>` — they handle anchoring, focus traps, backdrop, and light dismiss |
| Use `position: fixed` with manual z-index | Use the overlay components — they portal correctly and use the Z_INDEX scale |

---

## 3. Component Reference

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
| `<Modal>` | `.Header`, `.Body`, `.Footer`, `.Actions`, `.CloseButton` | `id`, `trigger`, `width` | `modal:shown`, `modal:hidden` |
| `<SlideOut>` | children (body content) | `id`, `trigger`, `position`, `title`, `width` | `slideout:shown`, `slideout:hidden` |
| `<Popup>` | children (popover content) | `id`, `trigger`, `placement` | `popup:shown`, `popup:hidden` |
| `<Tooltip>` | children (trigger element) | `content`, `side`, `align`, `delayDuration` | `tooltip:shown`, `tooltip:hidden` |
| `<DropdownMenu>` | data-driven via `items` | `trigger`, `items`, `side`, `align` | `menu:opened`, `menu:closed`, `menu:item_selected` |

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

## 4. `layout="auto"` — Fill & Corner-Squaring

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

## 5. Z-Index Scale

**Always import `Z_INDEX` from `ai-ui`.** Never hardcode z-index values.

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

## 6. CSS Variable Theme System (HSV-Derived)

All colours are controlled by CSS variables injected at `:root`:

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

## 7. Theme Slices

The theme system is extensible via **slices**. Each slice provides:
- A state interface
- CSS variable generation from that state
- An optional editor control for the Theme Editor

Built-in slices: `padding`, `margin`, `radius`, `shadow`, `animation`, `dataTable`, `tab`, `slideOut`, `accordion`, `card`, `tooltip`.

Register custom slices:
```tsx
import { globalThemeSliceRegistry, ThemeSlice } from 'ai-ui';

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

## 8. Event Bus — Complete Payload Reference

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
| `tab:changed` | `{ activeId: string; previousId?: string }` |
| `accordion:opened` | `{ id?: string; itemValue: string }` |
| `accordion:closed` | `{ id?: string; itemValue: string }` |
| `select:changed` | `{ name?: string; value: string }` |
| `slider:changed` | `{ name?: string; value: number }` |
| `menu:opened` | `{ id?: string }` |
| `menu:closed` | `{ id?: string }` |
| `menu:item_selected` | `{ id?: string; itemValue: string }` |
| `tooltip:shown` | `{ id?: string; content: string }` |
| `tooltip:hidden` | `{ id?: string }` |
