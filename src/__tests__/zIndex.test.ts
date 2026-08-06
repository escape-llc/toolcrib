import { describe, it, expect } from 'vitest';
import { Z_INDEX } from '../theme/zIndex';

describe('AI-UI Standard Z-Index Scale Architecture', () => {
  it('enforces strict monotonic ordering across component layer tiers', () => {
    expect(Z_INDEX.BASE).toBeLessThan(Z_INDEX.STICKY);
    expect(Z_INDEX.STICKY).toBeLessThan(Z_INDEX.SPLITTER);
    expect(Z_INDEX.SPLITTER).toBeLessThan(Z_INDEX.DRAWER);
    expect(Z_INDEX.DRAWER).toBeLessThan(Z_INDEX.MODAL);
    expect(Z_INDEX.MODAL).toBeLessThan(Z_INDEX.DROPDOWN);
    expect(Z_INDEX.DROPDOWN).toBeLessThan(Z_INDEX.TOOLTIP);
    expect(Z_INDEX.TOOLTIP).toBeLessThan(Z_INDEX.TOAST);
  });

  it('keeps z-index scale reasonable and bounded below 1000', () => {
    Object.values(Z_INDEX).forEach(val => {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1000);
    });
  });
});
