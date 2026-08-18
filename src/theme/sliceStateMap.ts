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

/**
 * The live, fully-populated counterpart to `ToolcribSliceStateMap` above --
 * every registered slice's *complete* state (not the partial overrides
 * `initialSliceStates`/a theme snapshot may specify), the exact shape
 * `ThemeContextType.sliceStates` exposes at runtime and `setSliceState`
 * accepts a `Partial` patch against. Derived with a mapped type from the
 * same declaration-merged interface, so there is exactly one source of
 * truth for which slices exist and what their state shapes are -- adding a
 * slice's `declare module` entry above is still the only thing a new
 * component ever needs to do to participate in both.
 */
export type ToolcribSliceStates = {
  [K in keyof ToolcribSliceStateMap]: Required<ToolcribSliceStateMap[K]>;
};
