import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadExamples } from '../src/lib/examples.js';
import { buildFakeProject, cleanupFakeProject } from './fixtures.js';

describe('examples', () => {
  let projectRoot, examples;

  afterEach(() => cleanupFakeProject(projectRoot));

  it('lists examples with a one-line description pulled from the first non-heading line', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    examples = loadExamples(built.vendoredRoot);
    expect(examples.listExamples()).toEqual([
      { name: 'router-integration', description: 'Bridge aiBus navigate events to a real router.' },
    ]);
  });

  it('returns one example\'s full content by name, or null if unknown', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    examples = loadExamples(built.vendoredRoot);
    expect(examples.getExample('router-integration')).toContain('# Router Integration');
    expect(examples.getExample('nonexistent')).toBe(null);
  });

  it('falls back to an empty description when a file has no non-heading line', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    fs.writeFileSync(path.join(built.vendoredRoot, 'ai-docs', 'examples', 'heading-only.md'), '# Just A Heading\n');
    examples = loadExamples(built.vendoredRoot);
    expect(examples.listExamples()).toContainEqual({ name: 'heading-only', description: '' });
  });

  it('returns an empty list rather than throwing when the examples directory is missing', () => {
    const built = buildFakeProject();
    projectRoot = built.projectRoot;
    fs.rmSync(path.join(built.vendoredRoot, 'ai-docs', 'examples'), { recursive: true, force: true });
    examples = loadExamples(built.vendoredRoot);
    expect(examples.listExamples()).toEqual([]);
  });
});
