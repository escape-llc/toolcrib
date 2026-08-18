/**
 * The map of every registered theme slice's initial-state shape, keyed by
 * the slice's own `id` (the same lowercase ids `globalThemeSliceRegistry`
 * and the `cssVariables` computation already use — `drawer`, `accordion`,
 * `card`, ...). Built entirely through TypeScript declaration merging:
 * each slice file (e.g. `DrawerSlice.ts`) contributes its own entry
 * directly via a `declare module './sliceStateMap'` block, the same
 * self-registering spirit `globalThemeSliceRegistry.register()` and the
 * `@manifest`/`@barrelExport` tag system already use elsewhere in this
 * codebase. A new component's own slice file is the only place that needs
 * touching to plug into `ThemeProviderProps.initialSliceStates` — nothing
 * here, and nothing shared, ever needs editing again.
 *
 * Deliberately empty on its own — every entry lives in its owning slice's
 * file. `padding`/`margin`/`radius`/`shadow` are excluded on purpose: those
 * four are driven by `ThemeProviderProps.initialParameters`, a distinct,
 * pre-existing category (global HSV/spacing/corner-radius parameters), not
 * a per-component override slice.
 */

/** @barrelExport */
export interface ToolcribSliceStateMap {}
