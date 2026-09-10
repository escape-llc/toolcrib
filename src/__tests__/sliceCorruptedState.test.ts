import { describe, it, expect } from 'vitest';
import { globalThemeSliceRegistry } from '../theme/slice';
// Side-effect import -- populates the registry with every real component
// slice (registerThemeSlices.ts's own module-level `register()` calls),
// the same mechanism themeContext.tsx/serverThemeCSS.ts rely on.
import '../theme/registerThemeSlices';

// ~37 *Slice.tsx files independently show the identical shape: a
// `lookupMap[state.field] || lookupMap.default` fallback for an
// out-of-range enum value, all sitting at the same 60%/66.66% branch
// coverage with the fallback branch itself never exercised. That fallback
// exists for a real reason, not defensively for its own sake -- a
// consumer's persisted theme state (themePersistence.ts, localStorage)
// can genuinely go stale across a version bump that renames/removes an
// enum option, and getCSSVariables() has to degrade to a sane default
// rather than emit `undefined` into a CSS custom property. One generic,
// registry-driven test closes the whole class at once instead of ~37
// near-identical individual test files -- every slice gets the same real
// check: does it survive every field being corrupted to a value outside
// its own declared enum, without throwing and without emitting undefined.
describe('every registered ThemeSlice survives a corrupted/stale persisted state', () => {
  const slices = globalThemeSliceRegistry.getAll();

  it('the registry actually has real slices registered (the side-effect import worked)', () => {
    expect(slices.length).toBeGreaterThan(30);
  });

  for (const slice of slices) {
    it(`${slice.id}: getCSSVariables() doesn't throw and emits no undefined values when every field is set to an out-of-range value`, () => {
      const corrupted: Record<string, unknown> = {};
      for (const key of Object.keys(slice.defaultState as object)) {
        corrupted[key] = '__invalid_enum_value__';
      }

      let result: Record<string, string> | undefined;
      expect(() => {
        result = slice.getCSSVariables(corrupted as never);
      }).not.toThrow();

      for (const [cssVar, value] of Object.entries(result ?? {})) {
        expect(value, `${slice.id}'s ${cssVar} was undefined for a corrupted field value`).toBeDefined();
      }
    });
  }
});
