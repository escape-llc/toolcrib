import { describe, it, expect } from 'vitest';
import { getTableVariables, DataTableThemeSlice, DENSITY_ROW_HEIGHT_PX, type TableDensity } from '../components/DataTable/DataTableSlice';

describe('DataTable Theme Slice Engine', () => {
  it('generates correct CSS variables for normal table density', () => {
    const vars = getTableVariables({
      density: 'normal',
      borderStyle: 'horizontal',
      striped: true,
    });

    expect(vars['--ai-table-cell-padding']).toBe('var(--ai-padding-sm, 0.625rem 1rem)');
    expect(vars['--ai-table-header-padding']).toBe('var(--ai-padding-md, 0.75rem 1rem)');
    expect(vars['--ai-table-stripe-bg']).toBe('var(--ai-bg-container, #f9fafb)');
  });

  it('generates correct CSS variables for compact table density', () => {
    const vars = getTableVariables({
      density: 'compact',
      borderStyle: 'grid',
      striped: false,
    });

    expect(vars['--ai-table-cell-padding']).toBe('0.4375rem 0.625rem');
    expect(vars['--ai-table-row-height']).toBe('1.8125rem');
    expect(vars['--ai-table-stripe-bg']).toBe('transparent');
  });

  it('exports correct ThemeSlice metadata', () => {
    expect(DataTableThemeSlice.id).toBe('table');
    expect(DataTableThemeSlice.defaultState.density).toBe('normal');
  });

  // Regression for issue #339: --ai-table-row-height (a rem string) and
  // DataTable.tsx's own itemHeight default (a JS px number) must derive
  // from the exact same source, or the real virtualization math and the
  // CSS row height it's supposed to match can silently drift apart again.
  it('derives --ai-table-row-height from DENSITY_ROW_HEIGHT_PX for every density, at 16px root font-size', () => {
    (['compact', 'normal', 'spacious'] as TableDensity[]).forEach(density => {
      const vars = getTableVariables({ density, borderStyle: 'horizontal', striped: true });
      const expectedRem = `${DENSITY_ROW_HEIGHT_PX[density] / 16}rem`;
      expect(vars['--ai-table-row-height']).toBe(expectedRem);
    });
  });

  // compact/spacious are DERIVED from normal's 44px baseline via
  // DENSITY_MULTIPLIER (0.65x / 1.3x), not independently hand-picked --
  // round(44 * 0.65) = 29, round(44 * 1.3) = 57.
  it('DENSITY_ROW_HEIGHT_PX derives compact/spacious from normal (44px) via DENSITY_MULTIPLIER', () => {
    expect(DENSITY_ROW_HEIGHT_PX).toEqual({ compact: 29, normal: 44, spacious: 57 });
  });
});
