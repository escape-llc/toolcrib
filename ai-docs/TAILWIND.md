# Toolcrib — For Tailwind Developers

A vocabulary translation, not a migration guide — for the subset of users who already think in Tailwind's utility-class vocabulary and need a fast mapping to toolcrib's terms. If you're actually adopting toolcrib into an existing app (Tailwind-based or otherwise), read `REFACTOR_APP.md` for the real step-by-step; this doc only exists to shortcut the "wait, how do I even say `p-4 rounded-lg bg-blue-500` in this system" moment. Read alongside `CORE.md`, not instead of it.

## The one mental-model shift

Tailwind composes a look per-element from independent utility classes you pick by hand each time. Toolcrib inverts that: every component already has a look, sourced from a small set of generated design tokens (`--ai-*` CSS custom properties), and you don't touch spacing/color/radius values directly — you either accept the component's default, or nudge it through a typed prop (`gap`, `paddingMode`, `variant`, `subtheme`) that resolves back to the same token system every other component uses. There's no `className` prop to reach for at all — toolcrib components don't accept one, by design (see `CORE.md`'s anti-pattern table).

Concretely: `className="flex items-center gap-4 p-6 rounded-xl shadow-md bg-white"` isn't ported field-by-field — it's replaced by reaching for the toolcrib primitive that already *is* that pattern (`<Card>`, `<HStack>`), then adjusting only the axes it exposes as props.

## Cheat sheet

| Tailwind | Toolcrib |
|---|---|
| `flex flex-col gap-4` | `<VStack gap="md">` |
| `flex items-center gap-2` | `<HStack gap="sm">` (defaults to `align="center"`) |
| `justify-between` / `justify-center` | `<VStack justify="between">` / `justify="center"` (`start`\|`center`\|`end`\|`between`\|`around`) |
| `flex-wrap` | `<VStack wrap>` / `<HStack wrap>` |
| `p-2` / `p-4` / `p-6` (small → large) | `paddingMode="compact"` \| `"normal"` \| `"spacious"` on most containers, or a component's own default |
| `gap-1` … `gap-8` | `gap="xs"` \| `"sm"` \| `"md"` \| `"lg"` \| `"xl"` — a fixed 5-step scale, not Tailwind's ~12-step numeric one |
| `rounded-none` / `rounded-md` / `rounded-full` | Not a per-element prop — set once, globally, via `<ThemeProvider initialParameters={{ cornerRadiusMode: 'sharp' \| 'subtle' \| 'rounded' \| 'pill' }}>` or the Theme Editor. Every component reads the same setting. |
| `shadow-sm` / `shadow-md` | Built into components that use elevation (`<Card>`, overlays) — not an applied utility, and not currently instance-configurable. |
| `border rounded-lg shadow-sm bg-white p-6` (the "card" pattern) | `<Card>` — this whole combination is what `<Card>` already is. Reaching for `VStack`/`div` + manual border/shadow/radius to recreate it is the anti-pattern `CORE.md` calls out first. |
| `bg-blue-500 text-white`, `bg-red-100 text-red-700` (a colored/status pill) | `variant="primary"` (brand identity color) or `subtheme="error"` (status color) on components that support it (`Badge`, `Button`, `Toast`), plus `appearance="solid"` \| `"soft"` \| `"outline"` for the fill style. Never a raw hex/`bg-*`/`text-*` class. |
| `dark:bg-gray-800 dark:text-white` | No `dark:` variant classes anywhere. One global `isDarkMode` flag on `<ThemeProvider>`/`useTheme().toggleDarkMode()` re-resolves every component's tokens at once. |
| `text-sm text-gray-500`, `font-bold` | Not a per-instance override — a component's own text styling is fixed to its role (label, helper text, heading) and already token-driven. If a component doesn't already expose the axis you want (most don't expose font size/weight individually), it isn't meant to vary per instance. |
| `w-full` / `h-full` | Most layout primitives (`<Content>`, `<VStack>`) already fill their container by default — nothing to add. |
| `grid grid-cols-3 gap-4` | `<Grid columns={3} gap="md">` |
| `grid-cols-[repeat(auto-fit,minmax(200px,1fr))]` | `<Grid columns="auto-fit" minColWidth="12.5rem">` |
| An inline `style={{ ... }}` or arbitrary-value class (`w-[137px]`, `top-[13px]`) "just this once" | Doesn't exist here — no component accepts `style`/`className` at the type level, so there's no escape hatch to reach for. If the token system genuinely can't express what's needed, that's a real gap, not a one-off to route around; see `CORE.md`'s override/`StyleDomain` section for the sanctioned per-instance path first. |
| `p-2 md:p-4 lg:p-6` (density that changes per breakpoint) | A `{ base, sm?, md?, lg?, xl? }` object on `paddingMode`/`marginMode`/`cornerRadiusMode`, set once on `<ThemeProvider initialParameters={{...}}>` — see `CORE.md` §2.8. One global setting every component responds to at once, not a per-element class you repeat on each one. |

## One honest gap, not an oversight

- **No arbitrary-value syntax.** Tailwind's escape hatch for "this exact pixel value, this one time" (`w-[137px]`) has no toolcrib equivalent, and that's deliberate, not missing — the whole point of the token system is that no component-level styling decision is a one-off. See `CORE.md`'s Theme Editor / `overrides` section for where a genuinely novel value should go instead (a theme parameter or a slice override), not around the type system.

## Where to go next

This doc stops at vocabulary. For the actual mechanics — wiring providers, incremental adoption, coexisting with existing CSS/state — see `REFACTOR_APP.md`. For the full component/prop/token reference, see `CORE.md` and `component-manifest.json`.
