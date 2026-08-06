import { describe, it, expect } from 'vitest';
import { getTableVariables, DataTableThemeSlice } from '../components/DataTable/DataTableSlice';

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

    expect(vars['--ai-table-cell-padding']).toBe('0.375rem 0.625rem');
    expect(vars['--ai-table-row-height']).toBe('2.25rem');
    expect(vars['--ai-table-stripe-bg']).toBe('transparent');
  });

  it('exports correct ThemeSlice metadata', () => {
    expect(DataTableThemeSlice.id).toBe('table');
    expect(DataTableThemeSlice.defaultState.density).toBe('normal');
  });
});
