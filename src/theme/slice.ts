import { ReactNode } from 'react';

export interface ThemeSlice<
  TState = any,
  TVars extends Record<string, string> = Record<string, string>
> {
  id: string; // e.g. 'padding', 'margin', 'radius', 'shadow', 'color'
  name: string; // Human-readable label for Theme Editor (e.g. "Margin & Spacing")
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
