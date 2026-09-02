import { describe, it, expect, beforeEach } from 'vitest';
import { listSavedThemes, saveThemeToLibrary, deleteThemeFromLibrary, getThemeFromLibrary } from '../theme/themeLibrary';
import { type ThemeSnapshot } from '../theme/themePersistence';

const sampleSnapshot: ThemeSnapshot = { schemaVersion: 1, parameters: { baseColor: { h: 1, s: 2, v: 3 } } };

describe('themeLibrary (localStorage-backed)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty', () => {
    expect(listSavedThemes()).toEqual([]);
  });

  it('saves and lists a theme', () => {
    const entry = saveThemeToLibrary('My Theme', sampleSnapshot);
    expect(entry.name).toBe('My Theme');
    expect(entry.id).toBeTruthy();

    const list = listSavedThemes();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(entry.id);
    expect(list[0].snapshot.parameters?.baseColor).toEqual({ h: 1, s: 2, v: 3 });
  });

  it('lists most recently saved first, even when both saves land in the same millisecond', () => {
    // No artificial delay between the two saves -- listSavedThemes's own
    // reverse-before-sort tiebreak (see its doc comment) is what makes this
    // deterministic regardless of savedAt's millisecond resolution, not a
    // timing gap between the two calls. A previous version of this test
    // relied on a 2ms setTimeout to force distinct timestamps, which was
    // genuinely flaky under CI load (confirmed directly: it failed for
    // real on a loaded runner, not hypothetically).
    const first = saveThemeToLibrary('First', sampleSnapshot);
    const second = saveThemeToLibrary('Second', sampleSnapshot);

    const list = listSavedThemes();
    expect(list[0].id).toBe(second.id);
    expect(list[1].id).toBe(first.id);
  });

  it('retrieves a single saved theme by id', () => {
    const entry = saveThemeToLibrary('My Theme', sampleSnapshot);
    expect(getThemeFromLibrary(entry.id)?.name).toBe('My Theme');
    expect(getThemeFromLibrary('does-not-exist')).toBeUndefined();
  });

  it('deletes a saved theme', () => {
    const entry = saveThemeToLibrary('My Theme', sampleSnapshot);
    deleteThemeFromLibrary(entry.id);
    expect(listSavedThemes()).toEqual([]);
  });

  it('survives corrupted localStorage data without throwing', () => {
    localStorage.setItem('toolcrib-theme-library', 'not json at all {{{');
    expect(listSavedThemes()).toEqual([]);
  });

  it('filters out entries that are not recognizably a SavedTheme', () => {
    localStorage.setItem(
      'toolcrib-theme-library',
      JSON.stringify([
        { id: '1', name: 'Valid', savedAt: new Date().toISOString(), snapshot: sampleSnapshot },
        { id: '2', name: 'Missing snapshot' },
        'garbage',
        null,
      ])
    );
    const list = listSavedThemes();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Valid');
  });
});
