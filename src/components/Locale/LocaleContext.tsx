import React, { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { aiBus } from '../../eventBus/eventBus';

/**
 * Every overridable UI chrome string across toolcrib, keyed by component.
 * A closed, fully-enumerated set — not a `ThemeSlice`-style registry —
 * since there's no runtime registration step (like a slice's
 * `getCSSVariables`) to piggyback the extensibility on; adding a field
 * here is already the cheap version of "touch one place."
 *
 * Distinct from `<Calendar>`'s own `locale` prop (a BCP-47 tag driving
 * real month/day-name localization via `react-aria-components`'
 * `<I18nProvider>`) — this interface only covers hardcoded chrome text
 * (button labels, aria-labels) that mechanism doesn't touch at all.
 * @barrelExport
 */
export interface ToolcribLocaleStrings {
  pagination: {
    navLabel: string;
    previousPage: string;
    nextPage: string;
    page: (pageNumber: number) => string;
  };
  dataTable: {
    showingEntries: (from: number, to: number, total: number) => string;
    rowsPerPage: string;
    perPageOption: (size: number) => string;
    previousPage: string;
    nextPage: string;
  };
  carousel: {
    previousSlide: string;
    nextSlide: string;
    slidesTablist: string;
    /** `slideNumber` is 1-based. */
    goToSlide: (slideNumber: number) => string;
  };
  viewer: {
    closeViewer: string;
    previousItem: string;
    nextItem: string;
    zoomIn: string;
    zoomOut: string;
  };
  calendar: {
    previousMonth: string;
    nextMonth: string;
  };
  spinner: {
    loading: string;
  };
  tree: {
    treeLabel: string;
  };
  toast: {
    dismissToast: string;
  };
  combobox: {
    clearSelection: string;
    removeItem: (label: string) => string;
  };
}

/**
 * Every string above, at its current hardcoded value — mounting
 * `<LocaleProvider>` (or `<ToolcribProvider strings={...}>`) with no
 * overrides at all must change nothing visually, so every value here has
 * to match what each component literally rendered before this existed.
 * @barrelExport
 */
export const defaultLocaleStrings: ToolcribLocaleStrings = {
  pagination: {
    navLabel: 'Pagination',
    previousPage: 'Previous page',
    nextPage: 'Next page',
    page: (pageNumber) => `Page ${pageNumber}`,
  },
  dataTable: {
    showingEntries: (from, to, total) => `Showing ${from} to ${to} of ${total} entries`,
    rowsPerPage: 'Rows per page',
    perPageOption: (size) => `${size} per page`,
    previousPage: 'Previous page',
    nextPage: 'Next page',
  },
  carousel: {
    previousSlide: 'Previous slide',
    nextSlide: 'Next slide',
    slidesTablist: 'Slides',
    goToSlide: (slideNumber) => `Go to slide ${slideNumber}`,
  },
  viewer: {
    closeViewer: 'Close viewer',
    previousItem: 'Previous item',
    nextItem: 'Next item',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
  },
  calendar: {
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
  },
  spinner: {
    loading: 'Loading',
  },
  tree: {
    treeLabel: 'Tree',
  },
  toast: {
    dismissToast: 'Dismiss toast',
  },
  combobox: {
    clearSelection: 'Clear selection',
    removeItem: (label) => `Remove ${label}`,
  },
};

/** @barrelExport */
export type LocaleStringsOverride = { [K in keyof ToolcribLocaleStrings]?: Partial<ToolcribLocaleStrings[K]> };

function mergeLocaleStrings(overrides?: LocaleStringsOverride): ToolcribLocaleStrings {
  if (!overrides) return defaultLocaleStrings;
  const merged = { ...defaultLocaleStrings };
  for (const key of Object.keys(overrides) as (keyof ToolcribLocaleStrings)[]) {
    merged[key] = { ...defaultLocaleStrings[key], ...overrides[key] } as any;
  }
  return merged;
}

const LocaleContext = createContext<ToolcribLocaleStrings | undefined>(undefined);

export interface LocaleProviderProps {
  /** A partial override per component — only the fields you name are changed; everything else keeps its default English value. */
  strings?: LocaleStringsOverride;
  children: ReactNode;
}

/**
 * Batch-overrides every localizable UI string in one place. Optional and
 * graceful, like `RouterAdapterProvider` — not required-and-throws like
 * `ThemeProvider`: every string here already has a harmless English
 * default, so a consumer that never mounts this (or `ToolcribProvider`'s
 * `strings` pass-through) gets exactly today's behavior, unchanged.
 *
 * Reactive to the `strings` prop on every render (a plain derived value,
 * not a `useState` seeded only once) — there's no exposed setter API
 * here, so the only way to change locale strings later (e.g. a language
 * switcher) is by re-rendering with a new `strings` prop, and this must
 * actually pick that up rather than freezing at mount.
 * @barrelExport
 */
export const LocaleProvider: React.FC<LocaleProviderProps> = ({ strings, children }) => {
  const mergedStrings = useMemo(() => mergeLocaleStrings(strings), [strings]);

  // Mirrors ThemeProvider's own theme:changed broadcast (fired from its
  // injection effect) — so anything reacting outside React context
  // (analytics, a canvas-rendered widget, a separate portal) can pick up
  // a locale change without needing useLocaleStrings() access directly.
  useEffect(() => {
    aiBus.emit('locale:changed', { strings: mergedStrings });
  }, [mergedStrings]);

  return <LocaleContext.Provider value={mergedStrings}>{children}</LocaleContext.Provider>;
};

/**
 * Reads the current locale strings — the merged result if a
 * `<LocaleProvider>` is mounted above, or `defaultLocaleStrings` silently
 * otherwise. No warning on the no-provider path, unlike
 * `useRouterBridge()`: every field here has an always-valid English
 * fallback, so not mounting a provider is a normal, common case, not a
 * setup mistake to flag.
 * @barrelExport
 */
export function useLocaleStrings(): ToolcribLocaleStrings {
  return useContext(LocaleContext) ?? defaultLocaleStrings;
}
