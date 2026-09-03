import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import {
  ThemeProvider,
  useTheme,
  computeServerThemeCSS,
  TOOLCRIB_TYPOGRAPHY_BASE_STYLE_ID,
  TOOLCRIB_LINK_STYLE_ID,
  TOOLCRIB_RESPONSIVE_STYLE_ID,
  TOOLCRIB_THEME_TRANSITIONS_STYLE_ID,
} from '../theme/themeContext';
import { TOOLCRIB_SHARED_KEYFRAMES_STYLE_ID } from '../theme/animationKeyframes';
import { generateHarmonyPalette } from '../theme/harmonies';
import { hsvToCSS } from '../theme/hsv';

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

// SSR-safe theme injection: computeServerThemeCSS mirrors ThemeProvider's
// own computation (same private defaults, same pure helpers) so a
// consumer's SSR framework can render the same CSS synchronously, before
// hydration — closing the flash-of-unstyled-content gap the client-only
// injection effects leave otherwise.
describe('computeServerThemeCSS', () => {
  it('produces the same --ai-master-font-size a real mounted ThemeProvider injects, for default parameters', () => {
    const { rootVariablesCSS } = computeServerThemeCSS();

    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>
    );
    const mounted = document.documentElement.style.getPropertyValue('--ai-master-font-size');
    document.documentElement.removeAttribute('style');

    expect(mounted).not.toBe('');
    expect(rootVariablesCSS).toContain(`--ai-master-font-size: ${mounted};`);
  });

  it('reflects a custom baseColor, matching generateHarmonyPalette called directly', () => {
    const baseColor = { h: 30, s: 80, v: 90 };
    const { rootVariablesCSS } = computeServerThemeCSS({ baseColor });

    const expectedPrimary = hsvToCSS(generateHarmonyPalette({
      baseColor,
      harmonyMode: 'analogous',
      hueSpread: 30,
      darkenLightenFactor: 1.0,
      saturationFactor: 1.0,
      paddingMode: 'normal',
      marginMode: 'normal',
      cornerRadiusMode: 'rounded',
      isDarkMode: false,
    }).primary);

    expect(rootVariablesCSS).toContain(`--ai-color-primary: ${expectedPrimary};`);
    expect(rootVariablesCSS).not.toContain(hsvToCSS(generateHarmonyPalette({
      baseColor: { h: 217, s: 76, v: 96 },
      harmonyMode: 'analogous',
      hueSpread: 30,
      darkenLightenFactor: 1.0,
      saturationFactor: 1.0,
      paddingMode: 'normal',
      marginMode: 'normal',
      cornerRadiusMode: 'rounded',
      isDarkMode: false,
    }).primary));
  });

  it('emits a non-null responsiveCSS with a real @media block, and excludes those keys from rootVariablesCSS, for a responsive paddingMode', () => {
    const { rootVariablesCSS, responsiveCSS } = computeServerThemeCSS({
      paddingMode: { base: 'compact', lg: 'spacious' },
    });

    expect(responsiveCSS).not.toBeNull();
    expect(responsiveCSS).toContain('@media (min-width: 1024px)');
    // Padding-owned keys must not be *declared* in rootVariablesCSS — an
    // inline value there would permanently win the cascade over any
    // @media rule, same reasoning as the provider's own injection effect.
    // Anchored to a real declaration (line start, before the colon), not a
    // blind substring match: other slices legitimately *reference*
    // --ai-padding-sm as a var() fallback (e.g. --ai-table-cell-padding),
    // which isn't the same thing as padding's own key being declared here.
    expect(rootVariablesCSS).not.toMatch(/^\s*--ai-padding-\w+:/m);
  });

  it('returns responsiveCSS: null when nothing is under responsive control', () => {
    const { responsiveCSS } = computeServerThemeCSS();
    expect(responsiveCSS).toBeNull();
  });

  it('does not crash when initialParameters omits marginMode entirely, and behaves as "normal"', () => {
    const withoutMargin = computeServerThemeCSS({ baseColor: { h: 200, s: 50, v: 80 } });
    const explicitNormal = computeServerThemeCSS({ baseColor: { h: 200, s: 50, v: 80 }, marginMode: 'normal' });

    expect(withoutMargin.rootVariablesCSS).toBe(explicitNormal.rootVariablesCSS);
  });
});

describe('computeServerThemeCSS hydration safety', () => {
  // Also a beforeEach, not just afterEach: earlier tests in this file mount
  // a real <ThemeProvider>, whose own effects inject these same ids and
  // (correctly, by design — injectGlobalStyle is "create once, ever") never
  // remove them. Without clearing first, a test here would seed its "SSR"
  // element alongside an already-real leftover one from a prior test,
  // making every assertion below count stale pollution as a false failure.
  const clearInjectedStyles = () => {
    document.getElementById(TOOLCRIB_TYPOGRAPHY_BASE_STYLE_ID)?.remove();
    document.getElementById(TOOLCRIB_LINK_STYLE_ID)?.remove();
    document.getElementById(TOOLCRIB_SHARED_KEYFRAMES_STYLE_ID)?.remove();
    document.getElementById(TOOLCRIB_RESPONSIVE_STYLE_ID)?.remove();
    document.getElementById(TOOLCRIB_THEME_TRANSITIONS_STYLE_ID)?.remove();
    document.documentElement.removeAttribute('style');
  };
  beforeEach(clearInjectedStyles);
  afterEach(clearInjectedStyles);

  it('does not duplicate SSR-rendered <style> tags on client mount', () => {
    const ssr = computeServerThemeCSS();

    const typographyEl = document.createElement('style');
    typographyEl.id = TOOLCRIB_TYPOGRAPHY_BASE_STYLE_ID;
    typographyEl.textContent = ssr.typographyCSS;
    document.head.appendChild(typographyEl);

    const linkEl = document.createElement('style');
    linkEl.id = TOOLCRIB_LINK_STYLE_ID;
    linkEl.textContent = ssr.linkCSS;
    document.head.appendChild(linkEl);

    const keyframesEl = document.createElement('style');
    keyframesEl.id = TOOLCRIB_SHARED_KEYFRAMES_STYLE_ID;
    keyframesEl.textContent = ssr.keyframesCSS;
    document.head.appendChild(keyframesEl);

    const transitionsEl = document.createElement('style');
    transitionsEl.id = TOOLCRIB_THEME_TRANSITIONS_STYLE_ID;
    transitionsEl.textContent = ssr.transitionsCSS;
    document.head.appendChild(transitionsEl);

    render(
      <ThemeProvider>
        <div>content</div>
      </ThemeProvider>
    );

    expect(document.querySelectorAll(`#${TOOLCRIB_TYPOGRAPHY_BASE_STYLE_ID}`).length).toBe(1);
    expect(document.querySelectorAll(`#${TOOLCRIB_SHARED_KEYFRAMES_STYLE_ID}`).length).toBe(1);
    expect(document.querySelectorAll(`#${TOOLCRIB_THEME_TRANSITIONS_STYLE_ID}`).length).toBe(1);
    // injectGlobalStyle no-op'd against the pre-existing element rather
    // than re-creating it — content is exactly what was seeded, untouched.
    expect(document.getElementById(TOOLCRIB_TYPOGRAPHY_BASE_STYLE_ID)!.textContent).toBe(ssr.typographyCSS);
    expect(document.getElementById(TOOLCRIB_LINK_STYLE_ID)!.textContent).toBe(ssr.linkCSS);
  });

  it('recognizes the pre-existing responsive <style> tag on mount (no duplicate), then removes it once a live setter switches away from responsive control', () => {
    const responsiveConfig = { base: 'compact' as const, lg: 'spacious' as const };
    const ssr = computeServerThemeCSS({ paddingMode: responsiveConfig });

    const el = document.createElement('style');
    el.id = TOOLCRIB_RESPONSIVE_STYLE_ID;
    el.textContent = ssr.responsiveCSS!;
    document.head.appendChild(el);

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => (
        <ThemeProvider initialParameters={{ paddingMode: responsiveConfig }}>{children}</ThemeProvider>
      ),
    });

    // upsertGlobalStyle found the pre-existing (SSR-rendered) element and
    // left it as the one tag, rather than inserting a second copy.
    expect(document.querySelectorAll(`#${TOOLCRIB_RESPONSIVE_STYLE_ID}`).length).toBe(1);

    // A real, typed live update — switching paddingMode away from
    // responsive control entirely — must clean up the tag it owned
    // (removeGlobalStyle's branch), not leave a stale SSR copy behind.
    act(() => {
      result.current.setPaddingMode('compact');
    });

    expect(document.getElementById(TOOLCRIB_RESPONSIVE_STYLE_ID)).toBeNull();
  });
});
