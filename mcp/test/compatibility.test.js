import { describe, it, expect } from 'vitest';
import { checkCompatibility, COMPATIBLE_RANGE } from '../src/lib/compatibility.js';

describe('checkCompatibility', () => {
  it('returns null for a version within the verified range', () => {
    expect(checkCompatibility('0.12.0')).toBe(null);
  });

  it('returns null when no version is known at all (a separate concern from a mismatch)', () => {
    expect(checkCompatibility(undefined)).toBe(null);
    expect(checkCompatibility(null)).toBe(null);
  });

  it('returns null for a non-semver string rather than throwing', () => {
    expect(checkCompatibility('not-a-version')).toBe(null);
  });

  it('returns a descriptive warning for a version outside the verified range', () => {
    const warning = checkCompatibility('0.20.0');
    expect(warning).toContain('0.20.0');
    expect(warning).toContain(COMPATIBLE_RANGE);
  });

  it('flags an older version as outside the range too, not just newer ones', () => {
    expect(checkCompatibility('0.4.0')).not.toBe(null);
  });
});
