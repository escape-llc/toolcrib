/**
 * AI-UI Standard Z-Index Layering Scale
 *
 * Provides a clean, reasonable, and systematic z-index hierarchy across all toolkit components.
 */
export const Z_INDEX = {
  /** Base page flow elements (Cards, Grid, Stack, Accordion) */
  BASE: 0,
  /** Sticky elements (DataTable headers, Sticky Toolbars) */
  STICKY: 10,
  /** Resizable splitter handles */
  SPLITTER: 20,
  /** SlideOut slide-over drawers (including Theme Designer) */
  DRAWER: 100,
  /** Modal dialogs and alert popups */
  MODAL: 200,
  /** Inline popovers, Select dropdowns, and DropdownMenu items (floats above drawers & modals) */
  DROPDOWN: 300,
  /** Hover Tooltips (floats above dropdowns, drawers & modals) */
  TOOLTIP: 400,
  /** Floating notification toasts */
  TOAST: 500,
} as const;

export type ZIndexScale = keyof typeof Z_INDEX;
