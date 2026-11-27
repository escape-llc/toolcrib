import { describe, it, expect } from 'vitest';
import { mergeDescribedBy } from '../components/shared/mergeDescribedBy';

describe('mergeDescribedBy', () => {
  it('returns undefined when nothing is given', () => {
    expect(mergeDescribedBy()).toBeUndefined();
    expect(mergeDescribedBy(undefined, null, false, '', '   ')).toBeUndefined();
  });

  it('joins ids in argument order with a single space', () => {
    expect(mergeDescribedBy('a', 'b', 'c')).toBe('a b c');
  });

  it('splits space-separated lists and collapses extra whitespace', () => {
    expect(mergeDescribedBy('  a   b ', '\tc\nd')).toBe('a b c d');
  });

  it('drops falsy entries', () => {
    expect(mergeDescribedBy('a', undefined, null, false, 'b')).toBe('a b');
  });

  it('removes duplicates, keeping the first occurrence', () => {
    expect(mergeDescribedBy('a b', 'b c', 'a')).toBe('a b c');
  });
});
