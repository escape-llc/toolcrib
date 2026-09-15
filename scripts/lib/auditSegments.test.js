import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { SEGMENTS, SPLIT_CATEGORIES, isoWeekNumber, getSegmentForDate, findSegmentById, findCategorySplitDrift } from './auditSegments.js';

// Reads the committed manifest directly rather than importing extract.js --
// extract.js's own import.meta.url-based ROOT resolution throws under
// Vitest's Vite-based transform (see extract.test.js/buildGraph.test.js's
// own comments on this exact quirk). `npm test`/`vitest run` always run
// from the repo root, so process.cwd() is a safe, simple anchor here.
function readCommittedManifestComponentNames(category) {
  const manifestPath = path.resolve(process.cwd(), 'ai-docs', 'component-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  return manifest.components.filter((c) => c.category === category).map((c) => c.name);
}

describe('SEGMENTS', () => {
  it('has exactly 13 segments, each with a unique id', () => {
    expect(SEGMENTS.length).toBe(13);
    const ids = SEGMENTS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every segment is either a whole/split category or a set of dirs, not both', () => {
    for (const segment of SEGMENTS) {
      expect(['components', 'dirs']).toContain(segment.kind);
      if (segment.kind === 'components') {
        expect(segment.category).toBeTruthy();
        expect(segment.dirs).toBeUndefined();
      } else {
        expect(segment.dirs?.length).toBeGreaterThan(0);
        expect(segment.category).toBeUndefined();
      }
    }
  });
});

describe('isoWeekNumber / getSegmentForDate', () => {
  it('rotates to a different segment on each successive week, wrapping after 13', () => {
    // 2026-09-15 is a Tuesday; step forward a week at a time.
    const base = new Date('2026-09-15T00:00:00Z');
    const seen = [];
    for (let i = 0; i < 13; i++) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + i * 7);
      seen.push(getSegmentForDate(d).id);
    }
    expect(new Set(seen).size).toBe(13); // 13 distinct segments across 13 distinct weeks
    // The 14th week should land back on the same segment as the 1st.
    const wrapped = new Date(base);
    wrapped.setUTCDate(wrapped.getUTCDate() + 13 * 7);
    expect(getSegmentForDate(wrapped).id).toBe(seen[0]);
  });

  it('is deterministic for the same date', () => {
    const d = new Date('2026-11-03T12:34:56Z');
    expect(getSegmentForDate(d).id).toBe(getSegmentForDate(new Date(d)).id);
  });

  it('isoWeekNumber matches a known reference date (2026-01-01 is a Thursday, so it is ISO week 1)', () => {
    expect(isoWeekNumber(new Date('2026-01-01T00:00:00Z'))).toBe(1);
  });
});

describe('findSegmentById', () => {
  it('returns the matching segment', () => {
    expect(findSegmentById('cli').title).toBe('CLI');
  });

  it('throws on an unknown id', () => {
    expect(() => findSegmentById('does-not-exist')).toThrow(/Unknown audit segment id/);
  });
});

describe('findCategorySplitDrift', () => {
  it('reports no unassigned/duplicated names for a category with no real components (fixture check)', () => {
    const result = findCategorySplitDrift('Data Display', []);
    expect(result.unassigned).toEqual([]);
    expect(result.duplicated).toEqual([]);
  });

  it('flags a component present in the real category but named in none of its segments', () => {
    const result = findCategorySplitDrift(SPLIT_CATEGORIES.DATA_DISPLAY, ['Accordion', 'NotARealComponentYet']);
    expect(result.unassigned).toEqual(['NotARealComponentYet']);
  });

  it('flags a name assigned to more than one segment for the same category', () => {
    const fixtureSegments = [
      { id: 'seg-a', kind: 'components', category: 'Fixture', names: ['Widget', 'Gadget'] },
      { id: 'seg-b', kind: 'components', category: 'Fixture', names: ['Gadget', 'Gizmo'] },
    ];
    const result = findCategorySplitDrift('Fixture', ['Widget', 'Gadget', 'Gizmo'], fixtureSegments);
    expect(result.duplicated).toEqual([{ name: 'Gadget', segmentIds: ['seg-a', 'seg-b'] }]);
    expect(result.unassigned).toEqual([]);
  });

  // The inverse of "unassigned": a name in a segment's `names` list that no
  // longer matches any real component -- the component was renamed or
  // removed, and the hand-maintained list wasn't updated to match. Found by
  // an external Gemini review of the PR that introduced this file (#432) --
  // the original version only checked the "real component missing from
  // every segment" direction, not this one.
  it('flags a segment name that no longer exists in the real category (renamed/removed component)', () => {
    const fixtureSegments = [{ id: 'seg-a', kind: 'components', category: 'Fixture', names: ['Widget', 'OldGadgetName'] }];
    const result = findCategorySplitDrift('Fixture', ['Widget'], fixtureSegments);
    expect(result.stale).toEqual([{ name: 'OldGadgetName', segmentIds: ['seg-a'] }]);
    expect(result.unassigned).toEqual([]);
  });

  // Regression guard: the two split categories' hand-maintained `names` lists
  // (data-display-charts-media/lists-status, form-controls-value-inputs/composite)
  // must account for every component the real, current manifest has in that
  // category -- this is exactly the drift issue #407 itself anticipates ("re-verify
  // the proposed segment file lists against the real tree at implementation time").
  for (const category of Object.values(SPLIT_CATEGORIES)) {
    it(`"${category}"'s audit segments have no unassigned/duplicated/stale components, against the real committed manifest`, () => {
      const realNames = readCommittedManifestComponentNames(category);
      expect(realNames.length).toBeGreaterThan(0); // sanity: the manifest read actually found something
      const { unassigned, duplicated, stale } = findCategorySplitDrift(category, realNames);
      expect(unassigned).toEqual([]);
      expect(duplicated).toEqual([]);
      expect(stale).toEqual([]);
    });
  }
});
