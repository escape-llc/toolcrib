import '@testing-library/jest-dom';

// jsdom has no layout engine, so it never implements scrollIntoView.
// Radix Select's Content calls it on mount (to scroll the selected item
// into view) and throws without this — not a corner case, but the thing
// that silently made every Select-based control's dropdown unopenable in
// tests, which is why no test anywhere in this suite previously exercised
// picking an option from a <Select> (FieldRow, plain Select, Combobox's
// underlying list, etc.). Centralized here rather than per-file since it's
// an environment gap, not a component-specific concern.
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}
