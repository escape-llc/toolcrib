import { describe, it, expect, afterEach } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../theme/themeContext';

describe('ThemeProvider targetDocument', () => {
  afterEach(() => {
    // Provider effects only ever set custom properties (--ai-*), never
    // remove them — clean the real document between tests so one test's
    // injected values can't leak into another's assertions.
    document.documentElement.removeAttribute('style');
  });

  it('injects CSS variables onto the global document by default', () => {
    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>
    );

    expect(document.documentElement.style.getPropertyValue('--ai-master-font-size')).not.toBe('');
  });

  // Regression: targetDocument didn't exist — the effect always wrote to
  // the bare global `document`, so a second ThemeProvider instance
  // portaled into a different Document (e.g. an <iframe>'s own
  // contentDocument, for a "live" embedded demo) would inject its CSS
  // variables onto the *outer* page's <html> instead of its own, fighting
  // with whichever ThemeProvider already owns that outer page.
  it('injects CSS variables onto targetDocument instead, leaving the global document untouched', () => {
    const otherDoc = document.implementation.createHTMLDocument('other');

    render(
      <ThemeProvider targetDocument={otherDoc}>
        <div>content</div>
      </ThemeProvider>
    );

    expect(otherDoc.documentElement.style.getPropertyValue('--ai-master-font-size')).not.toBe('');
    expect(document.documentElement.style.getPropertyValue('--ai-master-font-size')).toBe('');
  });
});

// Regression coverage for the slice-state consolidation: ThemeProviderProps
// used to expose 28 separate `initial<X>State` props, one per registered
// slice. This verifies the single `initialSliceStates` prop that replaced
// them actually seeds each named slice's state, merged with that slice's
// own defaults for any field the override didn't specify.
describe('ThemeProvider initialSliceStates', () => {
  it('seeds multiple slices from one prop, merging each with its own defaults', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider initialSliceStates={{ drawer: { width: 'lg' }, accordion: { variant: 'bordered' } }}>
          {children}
        </ThemeProvider>
      ),
    });

    expect(result.current.sliceStates.drawer.width).toBe('lg');
    // Fields not named in the override still fall back to the slice's own default.
    expect(result.current.sliceStates.drawer.position).toBe('right');
    expect(result.current.sliceStates.accordion.variant).toBe('bordered');
  });

  it('leaves every slice at its own default when initialSliceStates is omitted', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    expect(result.current.sliceStates.drawer.width).toBe('md');
    expect(result.current.sliceStates.accordion.variant).toBe('cards');
  });
});

// Phase 2 regression coverage: ThemeContextType used to expose 28
// separately-named fields (tableState, drawerState, ...) each with its own
// hand-written setter. Both collapsed into one sliceStates record + one
// generic setSliceState -- this verifies the generic setter actually
// updates the right slice, merges with (rather than replacing) that
// slice's other fields, and leaves every other slice untouched.
describe('ThemeProvider setSliceState', () => {
  it('patches one named slice, merging with its other fields, without touching any other slice', () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    act(() => {
      result.current.setSliceState('drawer', { width: 'lg' });
    });

    expect(result.current.sliceStates.drawer.width).toBe('lg');
    // Untouched fields on the same slice survive the patch.
    expect(result.current.sliceStates.drawer.position).toBe('right');
    // A different slice is completely unaffected.
    expect(result.current.sliceStates.accordion.variant).toBe('cards');
  });
});
