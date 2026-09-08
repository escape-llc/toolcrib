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
    // 0.0.1 predates this project's actual first release (0.1.0) -- every
    // real release from 0.1.0 up is now empirically verified compatible
    // (see COMPATIBLE_RANGE's own comment), so a hypothetical pre-0.1.0
    // version is what's actually "older and out of range" here.
    expect(checkCompatibility('0.0.1')).not.toBe(null);
  });
});
