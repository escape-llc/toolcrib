import { type ReactNode } from 'react';

/**
 * Groups a slice under one of the Theme Editor's category sections —
 * the same vocabulary `@manifestCategory` uses for the component manifest,
 * so a slice's category always matches the category of the component(s)
 * it themes. Required (not inferred) for the same reason
 * `@manifestCategory` is: without a fixed, exhaustive set, the Theme
 * Editor's grouping would drift silently as slices are added, the way
 * CORE.md's hand-maintained tables drifted before generation existed.
 */
export type ThemeSliceCategory = 'Layout Primitives' | 'Containers' | 'Overlays' | 'Data Display' | 'Form Controls';

/** @barrelExport */
export interface ThemeSlice<
  TState = any,
  TVars extends Record<string, string> = Record<string, string>
> {
  id: string; // e.g. 'padding', 'margin', 'radius', 'shadow', 'color'
  name: string; // Human-readable label for Theme Editor (e.g. "Margin & Spacing")
  /** Which Theme Editor section this slice's control renders under. */
  category: ThemeSliceCategory;
  defaultState: TState;

  /**
   * Computes CSS Custom Properties for this slice.
   */
  getCSSVariables: (state: TState, globalContext?: any) => TVars;

  /**
   * Optional control component rendered automatically inside the Theme Editor panel.
   */
  renderEditorControl?: (
    state: TState,
    onChange: (newState: TState) => void
  ) => ReactNode;

  /**
   * Declares which output CSS variables each state field influences, e.g.
   * `{ padding: ['--ai-card-padding', '--ai-card-header-padding'] }`. Lets
   * `getSparseVariables()` emit only the variables actually affected by a
   * partial override (a per-instance or per-domain "overrides" prop),
   * instead of the full computed result — necessary because applying the
   * full result at instance/domain scope would shadow the global `:root`
   * value even for fields the caller never touched, breaking live Theme
   * Editor reactivity for anything using an override. Optional; slices
   * without it fall back to the full result via `getSparseVariables`
   * (still correct, just over-shadowing).
   */
  fieldVars?: { [K in keyof TState]?: string[] };
}

export class ThemeSliceRegistry {
  private slices: Map<string, ThemeSlice> = new Map();

  register<TState, TVars extends Record<string, string>>(slice: ThemeSlice<TState, TVars>) {
    this.slices.set(slice.id, slice);
  }

  get(id: string): ThemeSlice | undefined {
    return this.slices.get(id);
  }

  getAll(): ThemeSlice[] {
    return Array.from(this.slices.values());
  }

  computeAllVariables(states: Record<string, any>, globalContext?: any): Record<string, string> {
    let combinedVars: Record<string, string> = {};
    for (const [id, slice] of this.slices.entries()) {
      const state = states[id] !== undefined ? states[id] : slice.defaultState;
      const vars = slice.getCSSVariables(state, globalContext);
      combinedVars = { ...combinedVars, ...vars };
    }
    return combinedVars;
  }
}

export const globalThemeSliceRegistry = new ThemeSliceRegistry();

/**
 * Computes only the CSS variables a partial state override actually
 * affects, via `slice.fieldVars` — for applying an "overrides" prop (or a
 * style domain's contextual default) as inline style on one DOM node
 * without shadowing `:root` for fields the caller didn't touch. Falls back
 * to the slice's full computed result if it hasn't declared `fieldVars`.
 */
export function getSparseVariables<TState, TVars extends Record<string, string>>(
  slice: ThemeSlice<TState, TVars>,
  partial: Partial<TState>,
  globalContext?: any
): Partial<TVars> {
  const merged = { ...slice.defaultState, ...partial } as TState;
  const full = slice.getCSSVariables(merged, globalContext);

  if (!slice.fieldVars) {
    return full;
  }

  const providedKeys = (Object.keys(partial) as (keyof TState)[]).filter(
    (key) => partial[key] !== undefined
  );

  const sparse: Partial<TVars> = {};
  for (const key of providedKeys) {
    const varsForField = slice.fieldVars[key];
    if (!varsForField) continue;
    for (const varKey of varsForField) {
      const typedKey = varKey as keyof TVars;
      sparse[typedKey] = full[typedKey];
    }
  }
  return sparse;
}
