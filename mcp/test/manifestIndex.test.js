import { describe, it, expect, afterEach } from 'vitest';
import { loadManifestIndex } from '../src/lib/manifestIndex.js';
import { buildFakeProject, cleanupFakeProject } from './fixtures.js';

describe('manifestIndex', () => {
  let projectRoot, index;

  afterEach(() => cleanupFakeProject(projectRoot));

  it('lists categories, deduplicated and sorted', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    index = loadManifestIndex(built.vendoredRoot);
    expect(index.listCategories()).toEqual(['Containers', 'Overlays']);
  });

  it('lists components, optionally filtered by category', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    index = loadManifestIndex(built.vendoredRoot);
    expect(index.listComponents().map((c) => c.name)).toEqual(['Modal', 'AlertDialog', 'Card']);
    expect(index.listComponents('Overlays').map((c) => c.name)).toEqual(['Modal', 'AlertDialog']);
  });

  it('gets one component case-insensitively, or null if unknown', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    index = loadManifestIndex(built.vendoredRoot);
    expect(index.getComponent('modal').name).toBe('Modal');
    expect(index.getComponent('NoSuchThing')).toBe(null);
  });

  it('searches fuzzily and ranks the exact name highest', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    index = loadManifestIndex(built.vendoredRoot);
    const results = index.searchComponents('dialog');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].matchPercent).toBeGreaterThanOrEqual(results[results.length - 1].matchPercent);
    expect(results.map((r) => r.name)).toContain('AlertDialog');
  });

  it('searches correctly on a natural-language query with filler words, not just a bare keyword', () => {
    // Regression test: a harness may pass a user's raw wording straight
    // through as the query rather than a distilled keyword. Fuse's default
    // whole-string scoring loses the match entirely once filler words push
    // total query length past its threshold -- and English stopwords like
    // "for"/"the"/"to" fuzzy-match unrelated component names/descriptions
    // at high confidence purely by coincidence, so naive per-token OR
    // search isn't sufficient either. Both failure modes must stay fixed.
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    index = loadManifestIndex(built.vendoredRoot);

    const results = index.searchComponents('is there a dialog overlay component');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Modal');
  });

  it('falls back to the raw tokens when every word in the query is a stopword', () => {
    // Regression test for searchComponents' own fallback branch: if the
    // stopword filter empties the token list entirely (e.g. "how do I"),
    // searching nothing would silently return zero results even though the
    // caller clearly wants *something*. Falling back to the raw
    // (unfiltered) tokens keeps this from going quiet -- 'i' and 'do' still
    // fuzzy-match real component names/descriptions well enough to return
    // a non-empty result set, which is the only thing worth asserting here
    // (unlike the natural-language test above, there's no single "correct"
    // top result for a query with no real keyword at all).
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    index = loadManifestIndex(built.vendoredRoot);

    const results = index.searchComponents('how do i');
    expect(results.length).toBeGreaterThan(0);
  });

  it('does not throw on an empty or whitespace-only query', () => {
    // The innermost fallback (raw query as the sole search token) only
    // triggers when splitting on whitespace produces zero tokens at all --
    // an empty string or one that's only whitespace. Nothing meaningful to
    // assert about the result set's contents here (there's no real query to
    // match against); the regression this guards is a crash/throw, not a
    // specific ranking.
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    index = loadManifestIndex(built.vendoredRoot);

    expect(() => index.searchComponents('   ')).not.toThrow();
  });

  it('keeps the first-seen score for a component matched by a repeated token, does not overwrite with an equal one', () => {
    // Regression test for the per-token best-score merge's own untaken
    // branch: `prev === undefined || result.score < prev`. A duplicated
    // token (e.g. the same word appearing twice) produces byte-identical
    // fuse.search() results on its second pass, so every already-seen
    // item's second-pass score is exactly equal to (never less than) what
    // the first pass already recorded -- the map update is skipped, not
    // because prev is undefined, but because the strictly-less comparison
    // itself evaluates false. Asserting the result set is unaffected by
    // the duplication (identical to searching the term once) is the
    // observable behavior this branch exists to preserve.
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    index = loadManifestIndex(built.vendoredRoot);

    const once = index.searchComponents('dialog');
    const twice = index.searchComponents('dialog dialog');
    expect(twice.map((r) => r.name)).toEqual(once.map((r) => r.name));
    expect(twice.map((r) => r.matchPercent)).toEqual(once.map((r) => r.matchPercent));
  });

  it('returns event channels list-or-one-by-name, plus helper methods on the list form', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    index = loadManifestIndex(built.vendoredRoot);
    const all = index.getEventChannels();
    expect(all.channels).toHaveLength(2);
    expect(all.helperMethods).toEqual(['openModal', 'closeModal']);
    expect(index.getEventChannels('modal:shown')).toEqual({ name: 'modal:shown', payload: '{ id: string }' });
    expect(index.getEventChannels('nope')).toBe(null);
  });

  it('returns the theme system reference', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    index = loadManifestIndex(built.vendoredRoot);
    const theme = index.getThemeSystem();
    expect(theme.themeSystem.colorSpace).toBe('HSV');
    expect(theme.zIndexScale.MODAL).toBe(200);
  });
});
