import '@testing-library/jest-dom';
import { beforeEach, afterEach } from 'vitest';

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

// Fail any test that produces unexpected console.error/console.warn output
// instead of letting it print quietly alongside a green checkmark. This is
// the `act()`-warning class from AGENTS.md's own "act() warnings are not
// noise" section, generalized: that section documents 5 real bugs found
// only because someone happened to scroll a CI log looking for exactly
// this, not because anything failed the build. A real console.error/warn
// during a test is either (a) a genuine bug the component is reporting, or
// (b) an expected one a test deliberately triggers — case (b) already has
// an established, sanctioned pattern throughout this suite: scope a
// `vi.spyOn(console, 'error').mockImplementation(() => {})` around just the
// call(s) that produce it, then `mockRestore()`. That pattern composes
// correctly with the wrapper below: a test's own vi.spyOn call replaces
// `console.error`'s current implementation (which is this wrapper) for its
// own scope, so anything it deliberately suppresses never reaches
// `unexpectedConsoleOutput` at all — only console output NO test claimed
// responsibility for trips this gate. A plain reassignment here (not
// vi.spyOn) is deliberate: layering our own vi.spyOn on top of a test's own
// vi.spyOn on the same method is a real footgun (nested mock/restore
// ordering), which a one-time reassignment at module load avoids entirely.
const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);
let unexpectedConsoleOutput: string[] = [];

console.error = (...args: unknown[]) => {
  unexpectedConsoleOutput.push(`console.error: ${args.map(String).join(' ')}`);
  originalConsoleError(...args);
};
console.warn = (...args: unknown[]) => {
  unexpectedConsoleOutput.push(`console.warn: ${args.map(String).join(' ')}`);
  originalConsoleWarn(...args);
};

beforeEach(() => {
  unexpectedConsoleOutput = [];
});

afterEach(() => {
  const output = unexpectedConsoleOutput;
  unexpectedConsoleOutput = [];
  if (output.length > 0) {
    throw new Error(
      `Test produced ${output.length} unexpected console.error/warn call(s) — either fix the ` +
        `underlying issue, or if this output is genuinely expected, scope a ` +
        `vi.spyOn(console, 'error'/'warn').mockImplementation(() => {}) (with mockRestore() after) ` +
        `around just the call(s) that produce it, per AGENTS.md's "act() warnings are not noise" ` +
        `section.\n\n${output.join('\n')}`
    );
  }
});
