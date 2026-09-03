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
