import { describe, it, expect } from 'vitest';
import type { JSXElementConstructor } from 'react';
import { resolveIsDev } from '../theme/safeProps';
import type * as Toolcrib from '../index';

// No toolcrib component takes `style`/`className` (CORE.md principle 7), and
// the contract is compile-time only (#652): no runtime warning, no stripping.
// This derives every component the public barrel exports (a capitalized
// export that React can render) and fails `tsc` -- naming the offender --
// if any of their props ever accepts either. A new component is covered the
// moment it's exported; there's no list to keep in sync.
type Barrel = typeof Toolcrib;
type PropsOf<C> = C extends JSXElementConstructor<infer P> ? P : never;
type AcceptsStyle<C> = [PropsOf<C>] extends [never] ? false : 'style' extends keyof PropsOf<C> ? true : 'className' extends keyof PropsOf<C> ? true : false;
type ComponentNames = { [K in keyof Barrel]: K extends `${Uppercase<string>}${string}` ? (Barrel[K] extends JSXElementConstructor<never> ? K : never) : never }[keyof Barrel];
type StyleOffenders = { [K in ComponentNames]: AcceptsStyle<Barrel[K]> extends true ? K : never }[ComponentNames];

describe('style/className contract', () => {
  it('no exported component accepts style or className (checked by tsc)', () => {
    // Resolves to `true` only when StyleOffenders is empty; otherwise the
    // assignment fails to compile with the offending component names.
    const noOffenders: [StyleOffenders] extends [never] ? true : StyleOffenders = true;
    // The detector itself works: a component that takes style is caught, one that doesn't isn't.
    const catchesStyle: AcceptsStyle<(props: { style?: object }) => null> = true;
    const catchesClassName: AcceptsStyle<(props: { className?: string }) => null> = true;
    const passesClean: AcceptsStyle<(props: { label: string }) => null> = false;
    // And it really scans the barrel (an empty name set would pass vacuously):
    // a plain FC, a forwardRef component and a generic function component.
    const scansBarrel: 'Card' | 'Link' | 'Block' | 'Text' | 'DataTable' extends ComponentNames ? true : false = true;
    expect([noOffenders, catchesStyle, catchesClassName, passesClean, scansBarrel]).toEqual([true, true, true, false, true]);
  });
});

describe('resolveIsDev', () => {
  it('trusts import.meta.env.DEV when it is a real boolean, even false', () => {
    expect(resolveIsDev(true, 'production')).toBe(true);
    expect(resolveIsDev(false, 'development')).toBe(false);
  });

  it('falls back to process.env.NODE_ENV when the DEV signal is absent', () => {
    expect(resolveIsDev(undefined, 'development')).toBe(true);
    expect(resolveIsDev(undefined, 'production')).toBe(false);
  });

  it('defaults to true (dev) when neither signal is available', () => {
    expect(resolveIsDev(undefined, undefined)).toBe(true);
  });
});
