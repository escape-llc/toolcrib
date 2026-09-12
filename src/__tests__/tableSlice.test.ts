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

    expect(vars['--ai-table-cell-padding']).toBe('0.25rem 0.375rem');
    expect(vars['--ai-table-row-height']).toBe('1.9375rem');
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
  // DENSITY_ROW_HEIGHT_MULTIPLIER (0.65x / 1.3x), clamped to never go
  // below TEXT_LINE_HEIGHT_PX + CONTENT_VERTICAL_SAFETY_PX + 2x that
  // density's own (separately-multiplied) vertical padding -- a real
  // content-clipping bug Gemini caught on this PR's first pass, when both
  // row height and padding scaled off the SAME multiplier: round(44*0.65)
  // = 29px row height, but only 14px of padding, leaving less room than a
  // 14px/1.5-line-height cell's real ~21px line box needs. compact's floor
  // (21 + 2 + 2*4 = 31) now exceeds its own multiplier's 29px, so 31 wins;
  // spacious's floor (21 + 2 + 2*13 = 49) stays under its multiplier's
  // 57px, so the multiplier still wins there, unchanged from before.
  it('DENSITY_ROW_HEIGHT_PX derives compact/spacious from normal (44px), clamped to a content-fit floor', () => {
    expect(DENSITY_ROW_HEIGHT_PX).toEqual({ compact: 31, normal: 44, spacious: 57 });
  });

  // Direct regression for the Gemini-caught clipping bug: proves the
  // INVARIANT via the actual public CSS output (not the internal
  // multiplier constants), so a future retune that reintroduces the same
  // mistake -- scaling row height and padding by one shared multiplier --
  // fails this test regardless of which specific numbers it picks.
  it('every density\'s row height comfortably fits a 14px/1.5-line-height cell plus its own vertical padding', () => {
    const TEXT_LINE_HEIGHT_PX = 21; // 14px font-size * 1.5 default --ai-line-height
    (['compact', 'spacious'] as TableDensity[]).forEach(density => {
      const vars = getTableVariables({ density, borderStyle: 'horizontal', striped: true });
      const rowHeightPx = parseFloat(vars['--ai-table-row-height']) * 16;
      const verticalPaddingPx = parseFloat(vars['--ai-table-cell-padding']) * 16;
      expect(rowHeightPx).toBeGreaterThanOrEqual(TEXT_LINE_HEIGHT_PX + 2 * verticalPaddingPx);
    });
    // normal sources its padding from a live CSS var() token, not a plain
    // rem literal parseable the same way -- its own 44px/10px-fallback
    // combination already comfortably fits (44 >= 21 + 20) and was never
    // part of this bug, so it's checked directly rather than parsed.
    const normalVars = getTableVariables({ density: 'normal', borderStyle: 'horizontal', striped: true });
    const normalRowHeightPx = parseFloat(normalVars['--ai-table-row-height']) * 16;
    expect(normalRowHeightPx).toBeGreaterThanOrEqual(TEXT_LINE_HEIGHT_PX + 2 * 10);
  });
});
