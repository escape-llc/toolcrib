import { configureAxe } from 'vitest-axe';
import { act } from '@testing-library/react';
import type { AxeResults, RunOptions } from 'axe-core';

// vitest-axe's own bundled types (vitest-axe/extend-expect) augment a `Vi`
// namespace that doesn't match vitest 4.x's real Assertion<T> interface
// (confirmed directly: tsc reported toHaveNoViolations as unknown on every
// call site even with the runtime matcher correctly registered -- that
// package, 0.1.0, was last built against vitest ^0.17.0 and simply
// predates vitest's current type layout). A sibling .d.ts attempting the
// same fix separately didn't apply either -- nothing actually imports a
// bare .d.ts file, so it never entered the real compilation graph despite
// matching tsconfig.json's `include`. Declared here instead, in the one
// file every test actually imports for real, augmenting @vitest/expect's
// own Assertion<T> directly (confirmed via
// node_modules/@vitest/expect/dist/index.d.ts as the real interface
// `expect(x)`'s return type resolves to in this vitest version).
declare module '@vitest/expect' {
  interface Assertion<T = any> {
    toHaveNoViolations(): T extends AxeResults ? void : never;
  }
}

/**
 * The "handle what we can at build" half of a defense-in-depth pair with
 * e2e/accessibility.spec.ts's real-browser scan (the "rest in browser"
 * half) -- jsdom has no paint pipeline, so color-contrast is structurally
 * impossible to check here regardless of axe-core version, the identical
 * reason e2e/accessibility.spec.ts's own COLOR_CONTRAST_DISABLED carve-out
 * exists (confirmed independently: vitest-axe's own docs state the same
 * jsdom limitation). Every other axe rule -- accessible names,
 * aria-required-children, invalid role/aria-* combinations, landmark
 * structure -- is pure DOM-shape analysis, fully checkable here.
 *
 * Always scan document.body, never RTL's own `container` -- Radix's
 * Portal primitive (used directly by overlay components and internally by
 * composite controls like Select/Combobox/DatePicker/Toast) renders
 * outside `container` entirely, so scanning `container` alone would
 * silently miss all portaled content for a large share of this component
 * set. document.body is a strict superset of `container` for
 * non-portaled components too.
 */
const configuredAxe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
    // Confirmed via a real first run (Badge.test.tsx), not assumed up
    // front: "region" expects all page content to sit inside a landmark
    // (<main>, <nav>, ...) -- a whole-*page* structural concern. Every
    // one of these tests renders one isolated component fragment into a
    // bare container with no surrounding page chrome at all, so this
    // rule would fire on literally every file, unrelated to whether the
    // component itself has a real accessibility problem.
    // e2e/accessibility.spec.ts's own scan doesn't need this carve-out
    // because it scans the whole real demo page, which does have real
    // landmark structure around everything.
    region: { enabled: false },
  },
});

/**
 * Wraps the real axe scan in `act()` -- confirmed necessary via a real
 * failure, not precautionary: `await axe(...)` is itself an async gap, and
 * a Radix-heavy component (ContextMenu, e.g.) can have its own pending
 * internal effects (focus-scope setup, roving-tabindex, position
 * recalculation) flush during exactly that gap, outside React Testing
 * Library's own act() tracking -- a real "An update ... was not wrapped in
 * act(...)" warning, which this suite's own setup.ts fails the test on by
 * design (AGENTS.md's "act() warnings are not noise" section). Every
 * caller in this suite is async already (`await axe(...)`), so this is the
 * one place to fix it for all of them, not a per-call-site patch.
 */
export async function axe(html: Element | string, additionalOptions?: RunOptions): Promise<AxeResults> {
  let results!: AxeResults;
  await act(async () => {
    results = await configuredAxe(html, additionalOptions);
  });
  return results;
}
