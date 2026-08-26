import type { ThemeContextType } from './themeContext';
import type { ToolcribSliceStateMap } from './sliceStateMap';
import { resolveBaseMode } from './responsive';

/**
 * The one shared type + the only two functions that touch `ThemeContextType`
 * directly — `captureThemeSnapshot` (theme -> snapshot) and
 * `applyThemeSnapshot` (snapshot -> theme). Deliberately the *only* file
 * that knows about `ThemeContextType`'s setters.
 *
 * Every source of a `ThemeSnapshot` (a bundled preset in presetThemes.ts, a
 * saved entry in themeLibrary.ts's localStorage, an uploaded/downloaded
 * file in themeFileTransfer.ts) only ever produces or stores this same
 * plain-data shape — none of them import from this file's apply/capture
 * side, or from themeContext.tsx at all. The caller (ThemeEditor's UI) is
 * the one place that takes a snapshot from whichever source the user picked
 * and hands it to `applyThemeSnapshot` — so adding a new source later (e.g.
 * a remote URL) never needs to touch this file, and this file never needs
 * to know where a snapshot came from.
 */

/** @barrelExport */
export interface ThemeSnapshot {
  /** Bumped only if this shape ever changes incompatibly — lets `isThemeSnapshotLike` reject snapshots from a future/unknown format instead of silently half-applying them. */
  schemaVersion: 1;
  /** Display name, set when saved into the theme library (themeLibrary.ts) or exported to a file. */
  name?: string;
  /** ISO timestamp, set when captured. */
  savedAt?: string;
  parameters?: Partial<ThemeContextType['parameters']>;
  /**
   * Per-slice overrides, in the exact same `Partial<ToolcribSliceStateMap>`
   * shape `ThemeProviderProps.initialSliceStates` uses — a preset that only
   * cares about `parameters` (see presetThemes.ts) can omit this entirely,
   * and a snapshot that touches a slice doesn't need every one of that
   * slice's own fields either. One field replaces what used to be 28
   * separately-named ones (`tableState`, `drawerState`, ...) on this
   * interface, each requiring its own line in `captureThemeSnapshot`,
   * `applyThemeSnapshot`, and `isThemeSnapshotLike`'s validation below.
   */
  sliceStates?: Partial<ToolcribSliceStateMap>;
}

/**
 * Structural check only — not a deep, field-by-field schema. Every value
 * this toolkit reads eventually resolves through a `var(--x, fallback)` CSS
 * custom property, so a malformed or unrecognized field inside an
 * otherwise-valid slice object degrades to that fallback harmlessly rather
 * than crashing anything; the actual risk worth guarding against is "this
 * isn't a theme snapshot at all" (wrong file, corrupted JSON, a future
 * incompatible schemaVersion), which this does catch. No fixed key list to
 * maintain here anymore — `sliceStates` is one field, and any object value
 * for it (with each present entry itself an object) passes, regardless of
 * which slice ids it names; an unrecognized id degrades harmlessly on
 * apply, the same way an unrecognized field within a known slice already
 * did before this consolidation.
 */
export function isThemeSnapshotLike(data: unknown): data is ThemeSnapshot {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.schemaVersion !== 1) return false;
  if (d.parameters !== undefined && (typeof d.parameters !== 'object' || d.parameters === null)) return false;
  if (d.sliceStates !== undefined) {
    if (typeof d.sliceStates !== 'object' || d.sliceStates === null) return false;
    for (const value of Object.values(d.sliceStates as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) return false;
    }
  }
  return true;
}

/** Captures the theme's current live state (every field, not a partial) into a snapshot — the source for "save"/"export". */
export function captureThemeSnapshot(theme: ThemeContextType, name?: string): ThemeSnapshot {
  return {
    schemaVersion: 1,
    name,
    savedAt: new Date().toISOString(),
    parameters: theme.parameters,
    sliceStates: theme.sliceStates,
  };
}

/**
 * Applies a snapshot from *any* source uniformly — only ever calling this
 * toolkit's own already-public `setSliceState`/parameter setters (never
 * reaching into ThemeProvider's internals), and only for fields the
 * snapshot actually specifies, so a partial snapshot (e.g. a preset with
 * only `parameters.baseColor`) leaves everything else at its current value
 * instead of resetting it. Loops over whatever slice ids the snapshot
 * itself names, rather than a fixed list — a snapshot saved before a given
 * slice existed simply has nothing to apply for it, the same "missing key,
 * nothing to do" behavior the old field-by-field version had.
 */
export function applyThemeSnapshot(theme: ThemeContextType, snapshot: ThemeSnapshot): void {
  const p = snapshot.parameters;
  if (p) {
    if (p.baseColor) theme.setBaseColor(p.baseColor);
    if (p.harmonyMode) theme.setHarmonyMode(p.harmonyMode);
    if (typeof p.hueSpread === 'number') theme.setHueSpread(p.hueSpread);
    if (typeof p.darkenLightenFactor === 'number') theme.setDarkenLightenFactor(p.darkenLightenFactor);
    if (typeof p.saturationFactor === 'number') theme.setSaturationFactor(p.saturationFactor);
    // setPaddingMode/setMarginMode/setCornerRadiusMode are deliberately
    // bare-string-only (a responsive config is initialization-only, set
    // via ThemeProvider's initialParameters, not a live setter -- see
    // responsive.ts) -- a saved snapshot that captured a responsive
    // config restores only its `base` tier here, a safe degrade rather
    // than an error or a silently dropped restore.
    if (p.paddingMode) theme.setPaddingMode(resolveBaseMode(p.paddingMode));
    if (p.marginMode) theme.setMarginMode(resolveBaseMode(p.marginMode));
    if (p.cornerRadiusMode) theme.setCornerRadiusMode(resolveBaseMode(p.cornerRadiusMode));
    if (p.shadowMode) theme.setShadowMode(p.shadowMode);
    if (typeof p.isDarkMode === 'boolean') theme.setDarkMode(p.isDarkMode);
  }
  if (snapshot.sliceStates) {
    for (const [id, patch] of Object.entries(snapshot.sliceStates)) {
      if (!patch) continue;
      // Iterating a heterogeneous map loses the id<->value correlation
      // `setSliceState`'s generic signature otherwise enforces at every
      // ordinary call site (see ThemeEditor.tsx's calls, which stay fully
      // typed) -- this is the one deliberate, narrowly-scoped boundary
      // where that trade is made, for the same reason a Redux-style
      // reducer map needs one at its own rehydration boundary.
      theme.setSliceState(id as keyof ToolcribSliceStateMap, patch as never);
    }
  }
}
