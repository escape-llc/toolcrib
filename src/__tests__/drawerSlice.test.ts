import { describe, it, expect } from 'vitest';
import { getDrawerVariables, DrawerThemeSlice } from '../components/Overlay/DrawerSlice';

describe('DrawerThemeSlice Engine', () => {
  it('generates correct CSS variables for md width and subtle backdrop blur', () => {
    const vars = getDrawerVariables({
      width: 'md',
      position: 'right',
      backdropBlur: 'subtle',
      headerMargin: 'none',
      insetTop: 0,
    });

    expect(vars['--ai-drawer-width']).toBe('26rem');
    expect(vars['--ai-drawer-backdrop-blur']).toBe('0.125rem');
    expect(vars['--ai-drawer-header-margin']).toBe('0');
    expect(vars['--ai-drawer-duration']).toBe('var(--ai-transition-duration-normal, 250ms)');
  });

  it('generates 50vw width and detached header margin', () => {
    const vars = getDrawerVariables({
      width: '50vw',
      position: 'left',
      backdropBlur: 'heavy',
      headerMargin: 'detached',
      insetTop: 0,
    });

    expect(vars['--ai-drawer-width']).toBe('50vw');
    expect(vars['--ai-drawer-backdrop-blur']).toBe('0.5rem');
    expect(vars['--ai-drawer-header-margin']).toBe('0.75rem 0.75rem 0.5rem 0.75rem');
    expect(vars['--ai-drawer-header-border-radius']).toBe('var(--ai-radius-md, 0.375rem)');
  });

  it('default state emits a 0rem inset top', () => {
    expect(getDrawerVariables()['--ai-drawer-inset-top']).toBe('0rem');
    expect(DrawerThemeSlice.defaultState.insetTop).toBe(0);
  });

  it('emits the configured inset top in rem, clamping invalid values to 0', () => {
    const base = DrawerThemeSlice.defaultState;
    expect(getDrawerVariables({ ...base, insetTop: 2.5 })['--ai-drawer-inset-top']).toBe('2.5rem');
    expect(getDrawerVariables({ ...base, insetTop: -3 })['--ai-drawer-inset-top']).toBe('0rem');
    expect(getDrawerVariables({ ...base, insetTop: NaN })['--ai-drawer-inset-top']).toBe('0rem');
  });

  it('declares fieldVars so a partial insetTop override emits only its own variable', () => {
    expect(DrawerThemeSlice.fieldVars?.insetTop).toEqual(['--ai-drawer-inset-top']);
  });

  it('exports correct ThemeSlice metadata', () => {
    expect(DrawerThemeSlice.id).toBe('drawer');
    expect(DrawerThemeSlice.defaultState.width).toBe('md');
    expect(DrawerThemeSlice.defaultState.headerMargin).toBe('none');
  });
});
