# Worked Example: LocaleProvider

`<Calendar>`'s `locale` prop is a different concern from this file — it's
a BCP 47 tag driving real month/day-name localization via
`react-aria-components`'s `<I18nProvider>`. `<LocaleProvider>` is for
everything else: hardcoded chrome text (button labels, aria-labels —
"Previous page", "Loading", "Dismiss toast", ...) that mechanism never
touches at all, since it isn't a date.

## Override one string, or a hundred

```tsx
import { LocaleProvider } from '#toolcrib';

<LocaleProvider strings={{ pagination: { nextPage: 'Volgende' } }}>
  <App />
</LocaleProvider>
```

Only the fields you name change — every other string, on `pagination`
and on every other component, keeps its default English value. Mounting
`<LocaleProvider>` with no `strings` at all (or not mounting it) changes
nothing: every component reads `useLocaleStrings()` internally already,
and its no-provider fallback is the exact same English text that was
always hardcoded there.

## Batch-setting through `<ToolcribProvider>`

The common case doesn't need a separate `<LocaleProvider>` import at all —
`<ToolcribProvider>` takes the same `strings` prop and wires it through:

```tsx
<ToolcribProvider strings={{
  pagination: { previousPage: 'Vorige', nextPage: 'Volgende' },
  tree: { treeLabel: 'Boom' },
  toast: { dismissToast: 'Sluiten' },
}}>
  <App />
</ToolcribProvider>
```

This prop is deliberately named `strings`, not `locale` — reusing "locale"
here, when `<Calendar>`'s own `locale` prop means something completely
different, would be confusing even though there's no actual type
collision. `<LocaleProvider>` also stays independently exported for
advanced composition, same as `<ThemeProvider>`/`<ToastProvider>`.

## Templated strings are functions, not plain text

A handful of fields interpolate a runtime value — `pagination.page`,
`dataTable.showingEntries`, `carousel.goToSlide`, `combobox.removeItem` —
and are typed as functions, not strings:

```tsx
<LocaleProvider strings={{
  pagination: { page: (pageNumber) => `Pagina ${pageNumber}` },
}}>
```

Override the whole function — there's no partial-string templating or
ICU message format here, on purpose: a plain TypeScript function is
already fully expressive, and doesn't add a second syntax to learn on top
of the language you're already writing in.

## Reacting outside React context

`<LocaleProvider>` broadcasts `locale:changed` on `aiBus` whenever its
merged strings change — the same pattern `<ThemeProvider>` already uses
for `theme:changed`. Useful for anything that isn't a React component
reading `useLocaleStrings()` directly: a canvas-rendered widget, a
separate portal, or an analytics hook forwarding which locale a session
is actually using.

```ts
aiBus.on('locale:changed', ({ strings }) => {
  // strings is the full, merged ToolcribLocaleStrings — not just the diff.
});
```
