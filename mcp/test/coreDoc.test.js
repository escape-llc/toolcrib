import { describe, it, expect, afterEach } from 'vitest';
import { loadCoreDoc } from '../src/lib/coreDoc.js';
import { buildFakeProject, cleanupFakeProject } from './fixtures.js';

describe('coreDoc', () => {
  let projectRoot, doc;

  afterEach(() => cleanupFakeProject(projectRoot));

  function setup() {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    doc = loadCoreDoc(built.vendoredRoot);
  }

  it('lists sections with their heading level, in document order', () => {
    setup();
    expect(doc.listSections()).toEqual([
      { heading: '1. Root Setup', level: 2 },
      { heading: '2. Core Principles', level: 2 },
      { heading: 'Overlays', level: 3 },
    ]);
  });

  it('returns the whole document when no section is requested', () => {
    setup();
    expect(doc.getSection()).toContain('Toolcrib — Core Reference');
    expect(doc.getSection()).toContain('Overlays');
  });

  it('returns just one section, matched case-insensitively', () => {
    setup();
    expect(doc.getSection('root setup')).toContain('ToolcribProvider');
    expect(doc.getSection('root setup')).not.toContain('Core Principles');
  });

  it('returns null for an unknown section', () => {
    setup();
    expect(doc.getSection('Nonexistent Section')).toBe(null);
  });
});
