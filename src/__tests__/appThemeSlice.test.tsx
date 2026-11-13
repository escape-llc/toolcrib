import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, renderHook, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../theme/themeContext';
import { ThemeEditor } from '../components/ThemeEditor/ThemeEditor';
import { globalThemeSliceRegistry, type ThemeSlice } from '../theme/slice';
import { generateHarmonyPalette, generateMonochromaticSubTheme } from '../theme/harmonies';
import { hsvToCSS } from '../theme/hsv';
import { defaultParameters, computeServerThemeCSS } from '../theme/serverThemeCSS';
import { useSliceOverrides } from '../theme/useSliceOverrides';
import { SLICE_EDITOR_CONTROLS } from '../components/ThemeEditor/sliceEditorControls';

if (typeof window !== 'undefined' && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as any;
  (globalThis as any).ResizeObserver = ResizeObserverMock as any;
}

// An app-owned slice: registered from test code, not from src/theme/registerThemeSlices.ts,
// and deriving its colors from the live ThemeSliceContext (#926).
const APP_ID = 'app-priority-test';
const AppSlice: ThemeSlice<{ hue: number }> = {
  id: APP_ID,
  name: 'App Priority',
  category: 'Data Display',
  defaultState: { hue: 20 },
  fieldVars: { hue: ['--app-priority-main', '--app-priority-dark'] },
  getCSSVariables: (state, ctx) => {
    if (!ctx) return { '--app-priority-main': 'no-context', '--app-priority-dark': 'no-context' };
    const group = generateMonochromaticSubTheme(state.hue, ctx.palette.base, ctx.palette.bgSurface, ctx.isDarkMode);
    return { '--app-priority-main': hsvToCSS(group.main), '--app-priority-dark': String(ctx.isDarkMode) };
  },
};

function expectedMain(hue: number, isDarkMode: boolean) {
  const palette = generateHarmonyPalette({ ...defaultParameters, isDarkMode });
  return hsvToCSS(generateMonochromaticSubTheme(hue, palette.base, palette.bgSurface, isDarkMode).main);
}

const unregister = () =>
  (globalThemeSliceRegistry as unknown as { slices: Map<string, unknown> }).slices.delete(APP_ID);

describe('app-specific theme slice (#926)', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('style');
    globalThemeSliceRegistry.register(AppSlice);
  });
  afterEach(unregister);

  it('receives the live palette and dark mode at :root via ThemeProvider', () => {
    const { unmount } = render(<ThemeProvider initialParameters={{ isDarkMode: false }}><div /></ThemeProvider>);
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--app-priority-main')).toBe(expectedMain(20, false));
    expect(style.getPropertyValue('--app-priority-dark')).toBe('false');
    unmount();

    render(<ThemeProvider initialParameters={{ isDarkMode: true }}><div /></ThemeProvider>);
    expect(style.getPropertyValue('--app-priority-main')).toBe(expectedMain(20, true));
    expect(style.getPropertyValue('--app-priority-dark')).toBe('true');
  });

  it('receives the palette in computeServerThemeCSS output', () => {
    const css = computeServerThemeCSS({ isDarkMode: true }).rootVariablesCSS;
    expect(css).toContain(`--app-priority-main: ${expectedMain(20, true)};`);
    expect(css).toContain('--app-priority-dark: true;');
  });

  it('receives the palette in an instance override via useSliceOverrides', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider initialParameters={{ isDarkMode: true }}>{children}</ThemeProvider>
    );
    const { result } = renderHook(() => useSliceOverrides(AppSlice, { hue: 200 }), { wrapper });
    expect(result.current.vars['--app-priority-main']).toBe(expectedMain(200, true));
    expect(result.current.vars['--app-priority-dark']).toBe('true');
  });

  it('an override outside a ThemeProvider computes with no context rather than throwing', () => {
    const { result } = renderHook(() => useSliceOverrides(AppSlice, { hue: 200 }));
    expect(result.current.vars['--app-priority-main']).toBe('no-context');
  });
});

describe('<ThemeEditor sliceControls> (#926)', () => {
  beforeEach(() => globalThemeSliceRegistry.register(AppSlice));
  afterEach(unregister);

  const open = () => {
    fireEvent.click(screen.getByText('Data Display', { exact: false }));
    fireEvent.click(screen.getByText('App Priority'));
  };

  it('renders the provided control for a registered app slice, and its onChange updates the slice state', () => {
    render(
      <ThemeProvider>
        <ThemeEditor
          sliceControls={{
            [APP_ID]: (state, onChange) => (
              <button onClick={() => onChange({ hue: 111 })}>app control hue {state.hue}</button>
            ),
          }}
        />
      </ThemeProvider>
    );
    open();
    fireEvent.click(screen.getByText('app control hue 20'));
    expect(screen.getByText('app control hue 111')).toBeInTheDocument();
  });

  it('omits an app slice that has no control from either source', () => {
    render(<ThemeProvider><ThemeEditor /></ThemeProvider>);
    fireEvent.click(screen.getByText('Data Display', { exact: false }));
    expect(screen.queryByText('App Priority')).not.toBeInTheDocument();
  });

  it('the prop wins over a built-in SLICE_EDITOR_CONTROLS entry with the same id', () => {
    const original = SLICE_EDITOR_CONTROLS[APP_ID];
    SLICE_EDITOR_CONTROLS[APP_ID] = () => <span>built-in control</span>;
    try {
      render(
        <ThemeProvider>
          <ThemeEditor sliceControls={{ [APP_ID]: () => <span>prop control</span> }} />
        </ThemeProvider>
      );
      open();
      expect(screen.getByText('prop control')).toBeInTheDocument();
      expect(screen.queryByText('built-in control')).not.toBeInTheDocument();
    } finally {
      if (original) SLICE_EDITOR_CONTROLS[APP_ID] = original;
      else delete SLICE_EDITOR_CONTROLS[APP_ID];
    }
  });
});
