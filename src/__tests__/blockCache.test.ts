import { describe, it, expect } from 'vitest';
import { blocksCovering, planEvictions } from '../components/DataTable/blockCache';

describe('blocksCovering', () => {
  it('lists the blocks a row range touches', () => {
    expect(blocksCovering(0, 14, 100, null)).toEqual([0]);
    expect(blocksCovering(95, 105, 100, null)).toEqual([0, 1]);
    expect(blocksCovering(100, 200, 100, null)).toEqual([1]);
    expect(blocksCovering(573, 687, 100, 1000)).toEqual([5, 6]);
  });

  it('ignores rows before 0 and, with a known total, blocks past the last row', () => {
    expect(blocksCovering(-50, 20, 100, null)).toEqual([0]);
    expect(blocksCovering(950, 1100, 100, 1000)).toEqual([9]);
    expect(blocksCovering(0, 10, 100, 0)).toEqual([]);
    expect(blocksCovering(5, 5, 100, 1000)).toEqual([]);
  });
});

describe('planEvictions', () => {
  it('evicts least recently used first, down to the bound', () => {
    expect(planEvictions({ lruOrder: [1, 2, 3, 4], keep: () => false, maxCached: 2 })).toEqual([1, 2]);
    expect(planEvictions({ lruOrder: [1, 2], keep: () => false, maxCached: 2 })).toEqual([]);
  });

  it('skips kept blocks, even when that leaves the cache over the bound', () => {
    expect(planEvictions({ lruOrder: [1, 2, 3, 4], keep: b => b === 1 || b === 2, maxCached: 2 })).toEqual([3, 4]);
    expect(planEvictions({ lruOrder: [1, 2, 3], keep: () => true, maxCached: 1 })).toEqual([]);
  });
});
