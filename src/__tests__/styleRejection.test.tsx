import { describe, it, expect } from 'vitest';
import { Card } from '../components/Card/Card';
import { Button } from '../components/Form/FormComponents';
import { VStack } from '../components/Layout/Stack';

/**
 * This file has no meaningful runtime assertions — vitest's transpiler
 * (esbuild) strips types and ignores `@ts-expect-error` entirely, so the
 * `it()` below is just a placeholder to keep this file inside the normal
 * test run. Its real value is compile-time, via `npx tsc`: every
 * `@ts-expect-error` line below only "passes" if the line actually fails
 * to compile. If any of these components ever regains a `style`/
 * `className` prop (e.g. reverting to raw `HTMLAttributes<T>` instead of
 * `StyleFreeAttributes<T>`/`StyleFree<T>`, see `theme/safeProps.ts`), the
 * directive stops matching a real error and `tsc` fails on "Unused
 * '@ts-expect-error' directive" instead of silently compiling.
 */
describe('style/className are rejected at the type level', () => {
  it('is a compile-time-only check — see this file\'s header comment', () => {
    expect(true).toBe(true);
  });
});

function _typeOnlyNeverCalled() {
  // @ts-expect-error - Card does not accept `style`
  <Card style={{ color: 'red' }}>x</Card>;
  // @ts-expect-error - Card does not accept `className`
  <Card className="foo">x</Card>;

  // @ts-expect-error - Button does not accept `style`
  <Button style={{ color: 'red' }}>x</Button>;
  // @ts-expect-error - Button does not accept `className`
  <Button className="foo">x</Button>;

  // @ts-expect-error - VStack does not accept `style`
  <VStack style={{ color: 'red' }}>x</VStack>;
  // @ts-expect-error - VStack does not accept `className`
  <VStack className="foo">x</VStack>;
}

void _typeOnlyNeverCalled;
