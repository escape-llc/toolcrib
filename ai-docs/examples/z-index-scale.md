# Worked Example: Using the `Z_INDEX` Scale for a Custom Overlay

The anti-pattern table (CORE.md §3) says "hardcode `z-index` values" →
"use the `Z_INDEX` scale." This walks through *why* that matters with a
concrete failure case, not just the rule.

## The scenario

Say you need a custom floating element that isn't one of the toolkit's
existing overlay components — e.g. a small "unsaved changes" indicator
that has to stay visible and on top even while a `<Modal>` is open above
it. The instinct is to reach for a big number:

```tsx
// Don't do this.
<div style={{ position: 'fixed', top: 8, right: 8, zIndex: 9999 }}>
  Unsaved changes
</div>
```

## What actually breaks

`9999` "wins" against `<Modal>` today, but it wins by accident, not by
design — it's not positioned *relative to* the toolkit's own layering, it
just happens to be bigger than whatever the toolkit currently uses. Two
concrete ways this goes wrong later:

1. A future toolkit release (or a locally-vendored edit) raises `Toast`'s
   z-index past `9999` for an unrelated reason — now a toast notification
   silently renders *behind* this indicator, with no error, just wrong
   stacking that's easy to miss in review.
2. Nothing about `9999` documents *intent* — a future contributor reading
   this code has no way to tell "must stay above Modal" from "I picked a
   big number that worked." The `Z_INDEX` scale encodes that intent
   directly in the constant's name.

## The fix: position relative to the scale, not to a guess

```tsx
import { Z_INDEX } from '#toolcrib';

<div style={{ position: 'fixed', top: 8, right: 8, zIndex: Z_INDEX.MODAL + 1 }}>
  Unsaved changes
</div>
```

`Z_INDEX.MODAL` is currently `200` — but the exact number
was never the point; `Z_INDEX.MODAL + 1` stays correct even if that
number changes later, because it's expressed as a relationship ("just
above Modal") instead of a magic constant. If a genuinely new overlay
layer is needed with its own stable position in the hierarchy — not just
"one above an existing component" — that's a case for extending
`Z_INDEX` itself in `src/theme/zIndex.ts` (it's vendored, forkable source,
not a sealed constant), not for a one-off inline number.
