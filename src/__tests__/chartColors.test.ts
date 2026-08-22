import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSeriesColor } from '../components/Chart/chartColors';

describe('getSeriesColor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the fixed CSS variable reference for slots 0-7', () => {
    expect(getSeriesColor(0)).toBe('var(--ai-chart-series-1)');
    expect(getSeriesColor(7)).toBe('var(--ai-chart-series-8)');
  });

  it('never generates a 9th hue -- falls back to a muted token past slot 7', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getSeriesColor(8)).toBe('var(--ai-text-secondary)');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('warns only once per offending index', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    getSeriesColor(9);
    getSeriesColor(9);
    getSeriesColor(9);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
