'use client';

import { createContext, useContext } from 'react';
import type { ThemeSliceContext } from './slice';

/**
 * Carries the live `ThemeSliceContext` (palette + dark mode) from
 * `<ThemeProvider>` down to `useSliceOverrides`, so a per-instance override
 * of a palette-derived slice computes the same colors as `:root`. Its own
 * tiny module (not `themeContext.tsx`) so a component that only calls
 * `useSliceOverrides` doesn't pull the whole provider and every registered
 * slice into its bundle. `undefined` outside a `<ThemeProvider>`.
 */
export const ThemeSliceContextContext = createContext<ThemeSliceContext | undefined>(undefined);

/** The nearest `<ThemeProvider>`'s `ThemeSliceContext`, or `undefined` when there is none (never throws). */
export function useThemeSliceContext(): ThemeSliceContext | undefined {
  return useContext(ThemeSliceContextContext);
}
